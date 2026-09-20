/**
 * The licence check-in against Stripe itself, in TEST mode: a throwaway test subscription, a
 * licence issued by the site's own code, two checks through the real `/api/license/verify`
 * handler, and the two metadata fields read back off the subscription.
 *
 *   STRIPE_SECRET_KEY=sk_test_… pnpm check:license-checkin
 *
 * Skipped unless STRIPE_SECRET_KEY is an `sk_test_` key — there is deliberately no
 * STRIPE_ALLOW_LIVE escape hatch, because what is being proven is a write to a customer's
 * subscription and the only safe customer is one this test made. It signs with a keypair it
 * generates, so the real LICENSE_SIGNING_KEY is never read, and it deletes what it created. No
 * customer, subscription or licence identifier is printed.
 *
 * `license-chain.test.ts` proves the same behaviour against the real SDK with only its network
 * layer replaced, and needs no credentials. This one proves Stripe accepts and keeps the write.
 */
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import Stripe from 'stripe'

// The site's source imports its siblings without a file extension, which Vite resolves during the
// Astro build and plain node does not. Same hook as license-chain.test.ts, for the same reason.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return nextResolve(`${specifier}.ts`, context)
      } catch {
        /* fall through to the real resolution, and its error */
      }
    }
    return nextResolve(specifier, context)
  },
})

const key = (process.env.STRIPE_SECRET_KEY ?? '').trim()
const testMode = key.startsWith('sk_test_')

test('Stripe test mode keeps activated_at and last_check_day, and a second check adds nothing', { skip: testMode ? false : 'needs an sk_test_ key in STRIPE_SECRET_KEY (never a live one)' }, async () => {
  // A signing key of its own, set before the site's modules load, so the real one is never read.
  const { privateKey } = generateKeyPairSync('ed25519')
  process.env.LICENSE_SIGNING_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  const { licenseFor } = await import('../src/lib/stripe.ts')
  const { POST: verify } = await import('../src/pages/api/license/verify.ts')

  const stripe = new Stripe(key, { appInfo: { name: 'laikaorbit.com check:license-checkin' } })
  const checkIn = async (licence: string) => {
    const res = (await verify({
      request: new Request('https://laikaorbit.com/api/license/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: licence }) }),
    } as never)) as Response
    return (await res.json()) as { valid: boolean; reason?: string }
  }

  let product: Stripe.Product | undefined
  let price: Stripe.Price | undefined
  let customer: Stripe.Customer | undefined
  let subscription: Stripe.Subscription | undefined
  try {
    product = await stripe.products.create({ name: 'Orbit Pro — check-in probe' })
    price = await stripe.prices.create({ product: product.id, unit_amount: 1500, currency: 'nzd', recurring: { interval: 'month' } })
    customer = await stripe.customers.create({ payment_method: 'pm_card_visa', invoice_settings: { default_payment_method: 'pm_card_visa' } })
    subscription = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: price.id }] })
    assert.equal(subscription.status, 'active', 'the probe could not get a paying test subscription to check in with')

    const { key: licence } = await licenseFor(subscription.id)
    const today = new Date().toISOString().slice(0, 10)

    const first = await checkIn(licence)
    assert.equal(first.valid, true, first.reason ?? 'the licence did not verify')

    let sub = await stripe.subscriptions.retrieve(subscription.id)
    assert.match(sub.metadata.activated_at ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'Stripe did not keep activated_at')
    assert.equal(sub.metadata.last_check_day, today, 'Stripe did not keep the day of the check')
    const activated = sub.metadata.activated_at

    assert.equal((await checkIn(licence)).valid, true, 'a second check within the hour stopped verifying')
    sub = await stripe.subscriptions.retrieve(subscription.id)
    assert.equal(sub.metadata.activated_at, activated, 'the second check re-dated the activation')
    assert.equal(sub.metadata.last_check_day, today, 'the second check changed the day')
    assert.deepEqual(Object.keys(sub.metadata).sort(), ['activated_at', 'last_check_day', 'license_id'], 'the subscription carries more than the licence id and the two check-in fields')
  } finally {
    // Leave no probe data behind, whatever happened above.
    if (subscription) await stripe.subscriptions.cancel(subscription.id).catch(() => {})
    if (customer) await stripe.customers.del(customer.id).catch(() => {})
    if (price) await stripe.prices.update(price.id, { active: false }).catch(() => {})
    if (product) await stripe.products.update(product.id, { active: false }).catch(() => {})
  }
})
