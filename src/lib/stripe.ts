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

/** UTC day, the finest grain a check-in is ever kept at. */
export const checkInDay = (at: Date) => at.toISOString().slice(0, 10)

/**
 * Notes that a licence checked in, on the customer's own subscription: `activated_at` the first
 * time it ever checked, `last_check_day` the day of the latest check.
 *
 * Deliberately not a log. The app checks in hourly (`status()` in the app's license.mjs), and a
 * history of those checks would be a record of when someone had their machine on — so the write
 * happens at most once per subscription per day, and each day replaces the last. What is left
 * answers one question: is this licence alive. It is disclosed on /legal/privacy before any of it
 * is written; see TELEMETRY.md in the app repo.
 *
 * Never throws and never blocks the answer: a paid licence must not stop working because a
 * metadata write failed, and the error is logged by type only — a Stripe message can carry the
 * customer's own ids.
 */
export async function recordCheckIn(sub: Stripe.Subscription, now = new Date()): Promise<void> {
  const day = checkInDay(now)
  const activated = sub.metadata?.activated_at
  if (activated && sub.metadata?.last_check_day === day) return
  try {
    await stripe().subscriptions.update(
      sub.id,
      { metadata: { activated_at: activated || now.toISOString().replace(/\.\d{3}Z$/, 'Z'), last_check_day: day } },
      { idempotencyKey: `checkin-${sub.id}-${day}` },
    )
  } catch (e) {
    console.error('licence check-in not recorded', e instanceof Error ? e.name : 'unknown error')
  }
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } })
