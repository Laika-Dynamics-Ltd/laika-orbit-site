import type { APIRoute } from 'astro'
import { ConfigError, need } from '../../../lib/env'
import { publicKeyFor, verifyLicense } from '../../../lib/license'
import { callerIp, LIMITS, overLimitShared, WINDOW } from '../../../lib/rate-limit'
import { ACTIVE, json, recordCheckIn, stripe } from '../../../lib/stripe'

export const prerender = false

/**
 * Checks a licence for the app: POST { key } → { valid, status, renewsAt }. The signature proves
 * which subscription the key names; Stripe says whether that subscription still pays for Pro.
 *
 * A check that finds a paying subscription also records the check-in (see `recordCheckIn`), which
 * is how a live licence is told from a dormant one. Nothing about what the app did is sent or kept.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (await overLimitShared('verify', callerIp(request, clientAddress), LIMITS.verify, WINDOW)) {
    return json(429, { error: 'Too many requests from here. Try again in a few minutes.' })
  }
  let key = ''
  try {
    key = String((await request.json()).key ?? '')
  } catch {
    return json(400, { error: 'expected JSON { key }' })
  }
  try {
    const payload = verifyLicense(key, publicKeyFor(need('LICENSE_SIGNING_KEY')))
    if (!payload) return json(200, { valid: false, reason: 'not a genuine licence key' })
    const sub = await stripe().subscriptions.retrieve(payload.sub)
    if (sub.metadata?.license_id !== payload.lid) return json(200, { valid: false, reason: 'licence was replaced' })
    const item = sub.items.data[0]
    const valid = ACTIVE.has(sub.status)
    if (valid) await recordCheckIn(sub)
    return json(200, {
      valid,
      status: sub.status,
      plan: payload.plan,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      renewsAt: item?.current_period_end ? item.current_period_end * 1000 : null,
    })
  } catch (e) {
    if (e instanceof ConfigError) return json(503, { error: e.message })
    console.error('verify', e)
    return json(200, { valid: false, reason: 'subscription not found' })
  }
}
