import type { APIRoute } from 'astro'
import type Stripe from 'stripe'
import { ConfigError, need } from '../../../lib/env'
import { json, licenseFor, stripe } from '../../../lib/stripe'

export const prerender = false

/**
 * Stripe events. The one that matters is a completed checkout: it issues the licence (stored as
 * the subscription's license_id), so a customer who closes the tab before the success page still
 * has one. Subscription changes need no storage here: licence checks read the live status.
 */
export const POST: APIRoute = async ({ request }) => {
  let event: Stripe.Event
  try {
    const signature = request.headers.get('stripe-signature')
    if (!signature) return json(400, { error: 'missing stripe-signature' })
    const body = await request.text() // the raw body, as signed
    event = await stripe().webhooks.constructEventAsync(body, signature, need('STRIPE_WEBHOOK_SECRET'))
  } catch (e) {
    if (e instanceof ConfigError) return json(503, { error: e.message })
    return json(400, { error: 'signature verification failed' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object
        if (s.mode === 'subscription' && s.subscription && s.metadata?.product === 'orbit-pro') {
          const id = typeof s.subscription === 'string' ? s.subscription : s.subscription.id
          await licenseFor(id)
        }
        break
      }
      case 'customer.subscription.deleted':
      case 'customer.subscription.updated':
      case 'invoice.payment_failed':
        // status is read live on every licence check; nothing to store
        break
    }
    return json(200, { received: true })
  } catch (e) {
    console.error('webhook', event.type, e)
    return json(500, { error: 'handler failed' }) // Stripe retries
  }
}
