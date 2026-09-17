import Stripe from 'stripe'
import { need, stripeSecret } from './env'
import { type LicensePayload, newLicenseId, signLicense } from './license'

let client: Stripe | null = null
export function stripe(): Stripe {
  client ??= new Stripe(stripeSecret(), { appInfo: { name: 'laikaorbit.com' } })
  return client
}

/** Subscription states that keep Pro working. past_due keeps it during Stripe's retry window. */
export const ACTIVE = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due'])

/**
 * The licence key for a subscription, issuing one the first time. The licence id lives on the
 * subscription's metadata, so the webhook and the success page agree however they race.
 */
export async function licenseFor(subscriptionId: string): Promise<{ key: string; subscription: Stripe.Subscription }> {
  let sub = await stripe().subscriptions.retrieve(subscriptionId)
  let lid = sub.metadata?.license_id
  if (!lid) {
    lid = newLicenseId()
    sub = await stripe().subscriptions.update(subscriptionId, { metadata: { ...sub.metadata, license_id: lid } }, { idempotencyKey: `license-${subscriptionId}` })
    lid = sub.metadata.license_id ?? lid
  }
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const payload: LicensePayload = { v: 1, lid, sub: sub.id, cus: customer, plan: 'pro', iat: Math.floor(sub.created) }
  return { key: signLicense(payload, need('LICENSE_SIGNING_KEY')), subscription: sub }
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } })
