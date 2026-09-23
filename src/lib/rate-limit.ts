/**
 * A per-IP burst limit for the public write endpoints, in one place.
 *
 * Honest about what it is: an in-memory counter inside one serverless instance. Vercel runs several,
 * so the real ceiling is the limit times however many instances are warm — it stops a script hammering
 * one endpoint, it is not a shield against a distributed flood. That is Vercel's own firewall's job.
 * The point here is narrower: keep a loop from turning our Stripe API quota, or a licence-key guessing
 * run, into a bill or an outage. A shared store (KV) would be the next step if that ever matters.
 */
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
