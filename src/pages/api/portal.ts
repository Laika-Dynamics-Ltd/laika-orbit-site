import type { APIRoute } from 'astro'
import { ConfigError, need } from '../../lib/env'
import { publicKeyFor, verifyLicense } from '../../lib/license'
import { json, stripe } from '../../lib/stripe'

export const prerender = false

/** Stripe's customer portal (card, invoices, cancel, switch plan) for the holder of a licence key. */
export const POST: APIRoute = async ({ request, url }) => {
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
      return_url: `${url.protocol}//${url.host}/pro/account`,
    })
    return json(200, { url: portal.url })
  } catch (e) {
    if (e instanceof ConfigError) return json(503, { error: e.message })
    console.error('portal', e)
    return json(502, { error: 'could not open the billing portal' })
  }
}
