/**
 * A per-IP burst limit for the public endpoints, in one place.
 *
 * Two counters, deliberately. `overLimit` is in memory and per serverless instance, which means the
 * real ceiling it can enforce alone is the limit times however many instances happen to be warm —
 * close to no limit at all on a payments route. `overLimitShared` adds the counter that all of them
 * share: one row in the pulse worker's D1, upserted per call (POST /v1/limit, tools/pulse-ingest in
 * the app repo). The worker was chosen over Vercel KV or Upstash because it is already ours: no new
 * dependency, no new bill.
 *
 * The local count still runs first and can answer on its own, so an obvious flood costs no round
 * trip. The shared one is the authority for everything that gets past it.
 *
 * It fails OPEN. If the worker is slow, down or unconfigured, the request proceeds on the local
 * count alone. Blocking a paying customer's checkout because a counter is unreachable would be the
 * worse failure, and a distributed flood is Vercel's firewall's job either way.
 */
import { optional } from './env'
type Bucket = { n: number; first: number }

const buckets = new Map<string, Map<string, Bucket>>()

/** The caller's address, from Vercel's header first, since `clientAddress` throws on static routes. */
export function callerIp(request: Request, clientAddress?: string): string {
  try {
    return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || clientAddress || 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * True when this ip has already had `max` goes at `name` inside `windowMs`.
 * Counts the call it is asked about, so one call per request.
 */
export function overLimit(name: string, ip: string, max: number, windowMs: number, now = Date.now()): boolean {
  let seen = buckets.get(name)
  if (!seen) buckets.set(name, (seen = new Map()))
  const hit = seen.get(ip)
  if (!hit || now - hit.first > windowMs) {
    seen.set(ip, { n: 1, first: now })
    // the map is per-instance and never otherwise shrinks, so sweep the expired on the way past
    if (seen.size > 5000) for (const [k, v] of seen) if (now - v.first > windowMs) seen.delete(k)
    return false
  }
  hit.n += 1
  return hit.n > max
}

export const WINDOW = 10 * 60_000

/**
 * What each endpoint allows in ten minutes. Licence checks are the generous one on purpose: the app
 * checks in hourly, and a whole office behind one NAT address shares this counter.
 */
export const LIMITS = {
  checkout: 10,
  portal: 10,
  license: 20,
  verify: 120,
  waitlist: 5,
}

/** SHA-256 hex, via Web Crypto so this works the same in the Vercel function and under plain node. */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * The same question as `overLimit`, asked of the counter every instance shares.
 *
 * The caller's address never leaves this process: what goes to the worker is a SHA-256 of it salted
 * with RATE_LIMIT_SALT (or the token, if no separate salt is set), so the worker stores an opaque
 * string it cannot reverse and laikaorbit.com's privacy page stays true. The salt must be stable, or
 * every request would land in its own bucket and count to one for ever.
 */
export async function overLimitShared(name: string, ip: string, max: number, windowMs = WINDOW): Promise<boolean> {
  if (overLimit(name, ip, max, windowMs)) return true
  const endpoint = optional('PUBLIC_PULSE_ENDPOINT')
  const token = optional('RATE_LIMIT_TOKEN')
  if (!endpoint || !token) return false
  try {
    const who = await sha256Hex(`${optional('RATE_LIMIT_SALT') ?? token}:${ip}`)
    const r = await fetch(`${endpoint.replace(/\/+$/, '')}/v1/limit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, who, max, windowMs }),
      // short on purpose: this sits in front of checkout, and a slow counter must not become a slow buy
      signal: AbortSignal.timeout(600),
    })
    if (!r.ok) return false
    return ((await r.json()) as { over?: unknown }).over === true
  } catch {
    return false
  }
}
