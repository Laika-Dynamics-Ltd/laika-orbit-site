import type { APIRoute } from 'astro'
import { ConfigError, need, optional } from '../../lib/env'
import { publicKeyFor, verifyLicense } from '../../lib/license'
import { callerIp, LIMITS, overLimitShared, WINDOW } from '../../lib/rate-limit'
import { json, stripe } from '../../lib/stripe'

export const prerender = false

/**
 * Orbit Pro's OWN portal configuration, deliberately not the account default.
 * This Stripe account carries other Laika Dynamics customers on unrelated prices, so editing the
 * default configuration would change their billing portal too. This one allows switching between
 * the monthly and yearly Pro prices, which is what the pricing FAQ promises.
 */
const ORBIT_PORTAL_CONFIGURATION = 'bpc_1UHZz3GmHNUR8QoX6x2GEjFc'

/** Stripe's customer portal (card, invoices, cancel, switch plan) for the holder of a licence key. */
export const POST: APIRoute = async ({ request, url, clientAddress }) => {
  if (await overLimitShared('portal', callerIp(request, clientAddress), LIMITS.portal, WINDOW)) {
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
    if (!payload) return json(403, { error: 'not a genuine licence key' })
    const portal = await stripe().billingPortal.sessions.create({
      customer: payload.cus,
      configuration: optional('STRIPE_PORTAL_CONFIGURATION') ?? ORBIT_PORTAL_CONFIGURATION,
      return_url: `${url.protocol}//${url.host}/pro/account`,
    })
    return json(200, { url: portal.url })
  } catch (e) {
    if (e instanceof ConfigError) return json(503, { error: e.message })
    console.error('portal', e)
    return json(502, { error: 'could not open the billing portal' })
  }
}
