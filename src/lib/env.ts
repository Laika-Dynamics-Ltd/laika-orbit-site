/**
 * Server-side configuration for sales. Every value comes from the environment (Vercel project env,
 * or a local shell); nothing is committed. Test mode is enforced unless STRIPE_ALLOW_LIVE=1.
 *
 *   STRIPE_SECRET_KEY          sk_test_… (test mode) — required for checkout, licences, portal
 *   STRIPE_WEBHOOK_SECRET      whsec_…  — required for the webhook
 *   STRIPE_PRICE_PRO_MONTHLY   price_… for Orbit Pro monthly
 *   STRIPE_PRICE_PRO_YEARLY    price_… for Orbit Pro yearly
 *   STRIPE_AUTOMATIC_TAX       "1" once Stripe Tax is set up (origin address + registrations)
 *   LICENSE_SIGNING_KEY        Ed25519 private key, PKCS#8 PEM (or base64 of it)
 *   SALES_OPEN                 "1" to take payments; otherwise Pro buttons join the waitlist
 *   RESEND_API_KEY, RESEND_AUDIENCE_ID   waitlist storage (optional)
 *   STRIPE_ALLOW_LIVE          "1" to allow an sk_live_ key (needs Joe's go-ahead)
 */
const read = (name: string): string | undefined => {
  // `import.meta.env` exists in the Astro/Vite build but not under plain node, where the tests
  // drive these same handlers, so fall through to process.env instead of throwing.
  const v = (import.meta.env?.[name] as string | undefined) ?? process.env[name]
  return v && v.trim() ? v.trim() : undefined
}

export class ConfigError extends Error {}

export function need(name: string): string {
  const v = read(name)
  if (!v) throw new ConfigError(`${name} is not set`)
  return v
}

export const optional = read

export function stripeSecret(): string {
  const key = need('STRIPE_SECRET_KEY')
  if (!key.startsWith('sk_test_') && !key.startsWith('rk_test_') && read('STRIPE_ALLOW_LIVE') !== '1') {
    throw new ConfigError('STRIPE_SECRET_KEY is not a test-mode key, and STRIPE_ALLOW_LIVE is not set')
  }
  return key
}

export const salesOpen = () => read('SALES_OPEN') === '1'
export const automaticTax = () => read('STRIPE_AUTOMATIC_TAX') === '1'
