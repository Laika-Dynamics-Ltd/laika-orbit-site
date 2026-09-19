import type { APIRoute } from 'astro'
import { automaticTax, ConfigError, need, salesOpen } from '../../lib/env'
import { json, stripe } from '../../lib/stripe'

export const prerender = false

/** Starts Stripe Checkout for Orbit Pro. Body: { plan: "monthly" | "yearly" }. */
export const POST: APIRoute = async ({ request, url }) => {
  if (!salesOpen()) return json(403, { error: 'Orbit Pro is not on sale yet. Join the waitlist instead.' })
  let plan: string
  try {
    plan = String((await request.json()).plan)
  } catch {
    return json(400, { error: 'expected JSON { plan }' })
  }
  if (plan !== 'monthly' && plan !== 'yearly') return json(400, { error: 'plan must be monthly or yearly' })
  try {
    const price = need(plan === 'monthly' ? 'STRIPE_PRICE_PRO_MONTHLY' : 'STRIPE_PRICE_PRO_YEARLY')
    const origin = `${url.protocol}//${url.host}`
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?cancelled=1`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      // GST/VAT: calculated by Stripe Tax once it is set up for the account
      automatic_tax: { enabled: automaticTax() },
      tax_id_collection: { enabled: automaticTax() },
      // the founding-price lock, said above the pay button and recorded on the subscription
      custom_text: { submit: { message: 'Founding price: yours for as long as you stay subscribed. The standard price becomes US$20 a month once Orbit Anywhere ships.' } },
      subscription_data: { metadata: { product: 'orbit-pro', plan, founding: 'true' } },
      metadata: { product: 'orbit-pro', plan },
    })
    return json(200, { url: session.url })
  } catch (e) {
    const message = e instanceof ConfigError ? e.message : 'Could not start checkout'
    console.error('checkout', e)
    return json(e instanceof ConfigError ? 503 : 502, { error: message })
  }
}
