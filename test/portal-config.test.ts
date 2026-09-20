/**
 * The billing portal must name its OWN configuration.
 *
 * The incident this guards: enabling plan switching on the Stripe account's DEFAULT billing portal
 * configuration changed the portal for every other Laika Dynamics customer on the same account,
 * who are on unrelated prices. The fix is that Orbit names a configuration of its own
 * (is_default false) and never falls back to the account default.
 *
 * What is real here: the whole `/api/portal` route, the licence signing and verification it does,
 * and the exact argument object it hands to Stripe. What is faked: the Stripe client's
 * `billingPortal.sessions.create`, which records its argument instead of calling Stripe.
 *
 * Safety: the signing pair is generated fresh in this file and thrown away, the Stripe secret is a
 * throwaway test-mode string, and no request leaves the process. Nothing reads or writes the real
 * Stripe account — creating or editing a portal configuration is what caused the incident, and
 * this test asserts the route never does it.
 *
 * Run: npm test
 */
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// The site's source imports its siblings without a file extension, which Vite resolves during the
// Astro build and plain node does not. Resolve those the way the build does, so this runs the real
// route file rather than a copy of it.
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

const PRIVATE_PEM = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
process.env.LICENSE_SIGNING_KEY = PRIVATE_PEM
process.env.STRIPE_SECRET_KEY = 'sk_test_throwaway_for_tests_only'
delete process.env.STRIPE_PORTAL_CONFIGURATION

const { signLicense } = await import('../src/lib/license.ts')
const { stripe } = await import('../src/lib/stripe.ts')
const { POST: portalPost } = await import('../src/pages/api/portal.ts')

/** `stripe()` memoises one client, so patching it here is what the route will use. */
let seen: Record<string, unknown> | null = null
stripe().billingPortal.sessions.create = (async (args: Record<string, unknown>) => {
  seen = args
  return { url: 'https://billing.stripe.test/session' }
}) as never

const KEY = signLicense({ v: 1, lid: 'lic_test', sub: 'sub_test', cus: 'cus_test', plan: 'pro', iat: 1 }, PRIVATE_PEM)

async function openPortal() {
  seen = null
  const res = await portalPost({
    request: new Request('https://laikaorbit.com/api/portal', { method: 'POST', body: JSON.stringify({ key: KEY }) }),
    url: new URL('https://laikaorbit.com/api/portal'),
  } as never)
  return res as Response
}

test('the portal session names a configuration rather than taking the account default', async () => {
  const res = await openPortal()
  assert.equal(res.status, 200, `route failed: ${await res.clone().text()}`)
  assert.ok(seen, 'no portal session was created')
  assert.ok(
    typeof seen!.configuration === 'string' && seen!.configuration,
    'no `configuration` passed, so Stripe would use the account default — the incident',
  )
  assert.match(String(seen!.configuration), /^bpc_[A-Za-z0-9]+$/)
  assert.equal(seen!.customer, 'cus_test')
})

test('STRIPE_PORTAL_CONFIGURATION overrides it, so test mode points elsewhere', async () => {
  process.env.STRIPE_PORTAL_CONFIGURATION = 'bpc_testmode'
  try {
    await openPortal()
    assert.equal(seen!.configuration, 'bpc_testmode')
  } finally {
    delete process.env.STRIPE_PORTAL_CONFIGURATION
  }
})

test('an unset override falls back to Orbit\'s own configuration, never to undefined', async () => {
  process.env.STRIPE_PORTAL_CONFIGURATION = ''
  try {
    await openPortal()
    assert.match(String(seen!.configuration), /^bpc_[A-Za-z0-9]+$/, 'an empty override must not reach Stripe as the account default')
  } finally {
    delete process.env.STRIPE_PORTAL_CONFIGURATION
  }
})

test('a key that is not genuine is refused before Stripe is touched', async () => {
  seen = null
  const res = (await portalPost({
    request: new Request('https://laikaorbit.com/api/portal', { method: 'POST', body: JSON.stringify({ key: 'not-a-licence' }) }),
    url: new URL('https://laikaorbit.com/api/portal'),
  } as never)) as Response
  assert.equal(res.status, 403)
  assert.equal(seen, null, 'a forged key must never reach Stripe')
})

test('nothing here edits a portal configuration — that is what caused the incident', () => {
  const src = readFileSync(join(HERE, '..', 'src', 'pages', 'api', 'portal.ts'), 'utf8')
  assert.doesNotMatch(
    src,
    /billingPortal\.configurations\.(create|update)/,
    'the site must never create or edit a Stripe portal configuration at runtime; that is done once, by hand, on a configuration that is not the account default',
  )
})
