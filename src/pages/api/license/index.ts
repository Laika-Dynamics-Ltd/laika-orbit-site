import type { APIRoute } from 'astro'
import { ConfigError } from '../../../lib/env'
import { callerIp, LIMITS, overLimitShared, WINDOW } from '../../../lib/rate-limit'
import { json, licenseFor, stripe } from '../../../lib/stripe'

export const prerender = false

/** The licence key for a finished checkout: GET /api/license?session_id=cs_… (the success page). */
export const GET: APIRoute = async ({ request, url, clientAddress }) => {
  if (await overLimitShared('license', callerIp(request, clientAddress), LIMITS.license, WINDOW)) {
    return json(429, { error: 'Too many requests from here. Try again in a few minutes.' })
  }
  const sessionId = url.searchParams.get('session_id') ?? ''
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return json(400, { error: 'invalid session_id' })
  try {
    const s = await stripe().checkout.sessions.retrieve(sessionId)
    if (s.status !== 'complete' || s.metadata?.product !== 'orbit-pro' || !s.subscription) {
      return json(402, { error: 'checkout is not complete' })
    }
    const id = typeof s.subscription === 'string' ? s.subscription : s.subscription.id
    const { key, subscription } = await licenseFor(id)
    return json(200, { key, email: s.customer_details?.email ?? null, status: subscription.status, plan: s.metadata?.plan ?? null })
  } catch (e) {
    if (e instanceof ConfigError) return json(503, { error: e.message })
    console.error('license', e)
    return json(404, { error: 'checkout not found' })
  }
}
