/**
 * The whole purchase chain, end to end, across both repos — with no network and no Stripe account.
 *
 * The site signs licences (`src/lib/license.ts`, issued by the webhook via `licenseFor()`) and the
 * app verifies them (`laika-orbit/packages/app/license.mjs`). The two halves live in different
 * repos and are released separately, so nothing else proves they still agree. A key signed by one
 * and rejected by the other means a real customer pays and gets nothing.
 *
 * What is real here: the webhook route, its Stripe signature check, `licenseFor()`, the Ed25519
 * signing, the `/api/license/verify` route, and the app's own `readKey()`/`decide()`/`isPro()`.
 * What is faked: Stripe's HTTP calls (a subclass of the real SDK, so signature verification stays
 * real) and `fetch`, which is routed straight into the verify route instead of over the wire.
 *
 * Safety: the signing pair is generated fresh inside this file and thrown away; no real secret is
 * read. HOME is redirected to a temp dir before the app module loads, so ~/.laika/license.json —
 * the real one, on this Mac — is never read or written.
 *
 * Run: npm test
 */
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { registerHooks } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { after, before, mock, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// The site's source imports its siblings without a file extension, which Vite resolves during the
// Astro build and plain node does not. Resolve those the way the build does, so the test can run
// the real route files rather than a copy of them.
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

// ---------------------------------------------------------------- isolation

// Before anything imports the app's licence module: it resolves ~/.laika/license.json once, at
// load, from homedir(), which follows $HOME. Point that somewhere disposable.
const REAL_HOME = process.env.HOME
const FAKE_HOME = mkdtempSync(join(tmpdir(), 'orbit-license-chain-'))
process.env.HOME = FAKE_HOME

const keys = generateKeyPairSync('ed25519')
const PRIVATE_PEM = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const PUBLIC_PEM = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString()
const OTHER = generateKeyPairSync('ed25519')

const WEBHOOK_SECRET = 'whsec_throwaway_for_tests_only'
process.env.LICENSE_SIGNING_KEY = PRIVATE_PEM
process.env.STRIPE_SECRET_KEY = 'sk_test_throwaway_for_tests_only'
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
process.env.ORBIT_LICENSE_PUBKEY = PUBLIC_PEM // the app checks against the pair made above
process.env.ORBIT_SITE = 'https://site.test'

// ------------------------------------------------------- the fake Stripe API

const SUB_ID = 'sub_1OrbitProTest'
const CUS_ID = 'cus_1OrbitProTest'
const CREATED = 1_789_600_000

type FakeSub = { id: string; customer: string; created: number; status: string; cancel_at_period_end: boolean; metadata: Record<string, string>; items: { data: Array<{ current_period_end: number }> } }

/** The subscription Stripe would hold. Reset per scenario. */
let subscription: FakeSub
let updateCalls: Array<{ id: string; params: unknown; options: unknown }>
const freshSubscription = (status = 'active'): FakeSub => ({
  id: SUB_ID,
  customer: CUS_ID,
  created: CREATED,
  status,
  cancel_at_period_end: false,
  metadata: {},
  items: { data: [{ current_period_end: 1_792_192_000 }] },
})

const RealStripe = (await import('stripe')).default

/**
 * The real SDK with only its network layer replaced, so `webhooks.constructEventAsync` below is
 * Stripe's own signature verification and not a stand-in for it.
 */
class FakeStripe extends RealStripe {
  constructor(...args: ConstructorParameters<typeof RealStripe>) {
    super(...args)
    // Only the two calls the site makes, standing in for the whole resource.
    ;(this as unknown as { subscriptions: unknown }).subscriptions = {
      retrieve: async (id: string) => {
        if (id !== subscription.id) throw Object.assign(new Error('No such subscription'), { code: 'resource_missing' })
        return structuredClone(subscription)
      },
      update: async (id: string, params: { metadata?: Record<string, string> }, options?: unknown) => {
        updateCalls.push({ id, params, options })
        subscription.metadata = { ...subscription.metadata, ...params.metadata }
        return structuredClone(subscription)
      },
    }
  }
}

// `exports` is what the runtime wants; @types/node still only describes the deprecated
// defaultExport/namedExports pair, which node now warns about.
mock.module('stripe', { exports: { default: FakeStripe, Stripe: FakeStripe } } as unknown as Parameters<typeof mock.module>[1])

// Imported after the mock is in place, so the site's cached client is the fake one.
const { licenseFor } = await import('../src/lib/stripe.ts')
const { POST: webhookPost } = await import('../src/pages/api/stripe/webhook.ts')
const { POST: verifyPost } = await import('../src/pages/api/license/verify.ts')

// ------------------------------------------------------------- the app half

const APP_LICENSE = process.env.ORBIT_APP_LICENSE ?? resolve(HERE, '../../laika-orbit/packages/app/license.mjs')
assert.ok(
  existsSync(APP_LICENSE),
  `The app's licence module was not found at ${APP_LICENSE}. This test exists to run the site and the app against each other; set ORBIT_APP_LICENSE if the app repo lives elsewhere.`,
)
const app = (await import(APP_LICENSE)) as {
  readKey: (key: string) => { v: number; lid: string; sub: string; cus: string; plan: string; iat: number } | null
  decide: (state: unknown, now?: number) => { pro: boolean; state: string; detail: string }
  activate: (key: string) => Promise<{ ok: boolean; error?: string; pro?: boolean }>
  status: (opts?: { force?: boolean }) => Promise<{ pro: boolean; state: string }>
  isPro: () => Promise<boolean>
  deactivate: () => Promise<unknown>
  publicKey: () => unknown
  GRACE_DAYS: number
}

// --------------------------------------------------------------- fake network

const realFetch = globalThis.fetch
/** Every request the app makes lands in the site's own route handler instead of on the wire. */
let siteReachable = true
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input)
  if (!siteReachable) throw new Error('offline (test)')
  if (url === 'https://site.test/api/license/verify') {
    return await verifyPost({ request: new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: init?.body as string }) } as never)
  }
  throw new Error(`the test made an unexpected network call to ${url}`)
}) as typeof fetch

before(() => {
  subscription = freshSubscription()
  updateCalls = []
})
after(async () => {
  globalThis.fetch = realFetch
  if (REAL_HOME) process.env.HOME = REAL_HOME
})

// ------------------------------------------------------------------- helpers

/** A checkout.session.completed event shaped like the one Stripe posts, signed like Stripe signs it. */
function checkoutEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_1OrbitProTest',
    object: 'event',
    api_version: '2025-08-27.basil',
    created: CREATED,
    type: 'checkout.session.completed',
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: 'cs_test_1OrbitProTest',
        object: 'checkout.session',
        mode: 'subscription',
        status: 'complete',
        payment_status: 'paid',
        customer: CUS_ID,
        customer_details: { email: 'buyer@example.test' },
        subscription: SUB_ID,
        currency: 'nzd',
        amount_total: 1500,
        metadata: { product: 'orbit-pro' },
        ...overrides,
      },
    },
  }
}

/** Posts an event to the real webhook route with a signature the real SDK will accept. */
async function postWebhook(event: unknown, { secret = WEBHOOK_SECRET } = {}) {
  const payload = JSON.stringify(event)
  const signature = new RealStripe('sk_test_throwaway_for_tests_only').webhooks.generateTestHeaderString({ payload, secret })
  return await webhookPost({
    request: new Request('https://site.test/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': signature, 'content-type': 'application/json' }, body: payload }),
  } as never)
}

// ------------------------------------------------------------------ the chain

test('a completed checkout issues a licence the app accepts, and turns Pro on', async () => {
  const res = await postWebhook(checkoutEvent())
  assert.equal(res.status, 200, await res.text())

  // The webhook put the licence id on the subscription, so the key survives a closed tab.
  assert.match(subscription.metadata.license_id ?? '', /^lic_[0-9a-f]{32}$/)
  assert.equal(updateCalls.length, 1)
  assert.deepEqual((updateCalls[0].options as { idempotencyKey: string }).idempotencyKey, `license-${SUB_ID}`)

  // Ed25519 is deterministic and the licence id is now stored, so this is byte for byte the key the
  // webhook issued — and the one the success page hands the customer.
  const { key } = await licenseFor(SUB_ID)
  assert.equal(updateCalls.length, 1, 'a second read must not re-issue the licence')
  assert.match(key, /^LO1\.[\w-]+\.[\w-]+$/)

  // --- the app half, the other repo, verifying with only the public key ---
  const payload = app.readKey(key)
  assert.ok(payload, 'the app rejected a key the site had just signed')
  assert.equal(payload.sub, SUB_ID)
  assert.equal(payload.cus, CUS_ID)
  assert.equal(payload.plan, 'pro')
  assert.equal(payload.lid, subscription.metadata.license_id)

  // --- and online, through the site's real verify route ---
  const activated = await app.activate(key)
  assert.equal(activated.ok, true, activated.error)
  assert.equal(await app.isPro(), true)
  assert.equal((await app.status()).state, 'active')

  // The store it wrote is the isolated one, not the real ~/.laika.
  const stored = JSON.parse(readFileSync(join(FAKE_HOME, '.laika', 'license.json'), 'utf8'))
  assert.equal(stored.key, key)
})

test('a webhook for anything but an Orbit Pro subscription issues nothing', async () => {
  subscription = freshSubscription()
  updateCalls = []
  const res = await postWebhook(checkoutEvent({ metadata: { product: 'something-else' } }))
  assert.equal(res.status, 200)
  assert.equal(updateCalls.length, 0)
  assert.equal(subscription.metadata.license_id, undefined)
})

test('a forged webhook signature issues nothing', async () => {
  subscription = freshSubscription()
  updateCalls = []
  const res = await postWebhook(checkoutEvent(), { secret: 'whsec_not_the_real_one' })
  assert.equal(res.status, 400)
  assert.equal(updateCalls.length, 0)
})

// ------------------------------------------------------- the failure directions

test('the app rejects a key with one character changed', async () => {
  subscription = freshSubscription()
  updateCalls = []
  const { key } = await licenseFor(SUB_ID)
  const [prefix, body, sig] = key.split('.')

  // one character of the signature
  const bentSig = `${prefix}.${body}.${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`
  assert.equal(app.readKey(bentSig), null)

  // one character of the payload
  const bentBody = `${prefix}.${body[0] === 'e' ? 'f' : 'e'}${body.slice(1)}.${sig}`
  assert.equal(app.readKey(bentBody), null)

  // a payload rewritten to name someone else's subscription, keeping the real signature
  const forged = Buffer.from(JSON.stringify({ ...app.readKey(key), sub: 'sub_someone_else' })).toString('base64url')
  assert.equal(app.readKey(`${prefix}.${forged}.${sig}`), null)

  for (const junk of ['', 'LO1', 'LO1..', 'LO2.a.b', 'not a key', `${key}x`]) assert.equal(app.readKey(junk), null)
})

test('the app rejects a key signed by a different key', async () => {
  subscription = freshSubscription()
  updateCalls = []
  const { key } = await licenseFor(SUB_ID)

  process.env.ORBIT_LICENSE_PUBKEY = OTHER.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  try {
    assert.equal(app.readKey(key), null, 'a key from another signer was accepted')
    assert.equal(app.decide({ key, valid: true, lastCheck: Date.now() }).pro, false)
    assert.equal(app.decide({ key, valid: true, lastCheck: Date.now() }).state, 'invalid')
  } finally {
    process.env.ORBIT_LICENSE_PUBKEY = PUBLIC_PEM
  }
  assert.ok(app.readKey(key), 'the right public key should still accept it')
})

test('a cancelled subscription turns Pro off, and the site says why', async () => {
  subscription = freshSubscription()
  updateCalls = []
  const { key } = await licenseFor(SUB_ID)
  await app.activate(key)
  assert.equal(await app.isPro(), true)

  subscription.status = 'canceled'
  const status = await app.status({ force: true })
  assert.equal(status.pro, false)
  assert.equal(status.state, 'inactive')

  // and it cannot be activated again from scratch
  await app.deactivate()
  const again = await app.activate(key)
  assert.equal(again.ok, false)
  assert.match(String(again.error), /canceled/)
})

test('past_due keeps Pro on through Stripe’s retry window', async () => {
  subscription = freshSubscription('past_due')
  updateCalls = []
  const { key } = await licenseFor(SUB_ID)
  await app.deactivate()
  assert.equal((await app.activate(key)).ok, true)
  assert.equal(await app.isPro(), true)
})

test('a replaced licence is refused, so an old key cannot outlive its reissue', async () => {
  subscription = freshSubscription()
  updateCalls = []
  const { key: old } = await licenseFor(SUB_ID)
  subscription.metadata.license_id = 'lic_00000000000000000000000000000000'
  await app.deactivate()
  const r = await app.activate(old)
  assert.equal(r.ok, false)
  assert.match(String(r.error), /replaced/)
})

test('after the grace period offline, Pro switches off', async () => {
  subscription = freshSubscription()
  updateCalls = []
  const { key } = await licenseFor(SUB_ID)
  const day = 86_400_000

  // signed, paid, checked in today
  assert.equal(app.decide({ key, valid: true, lastCheck: Date.now() }).pro, true)
  // a few days offline: still Pro, and saying so
  const midGrace = app.decide({ key, valid: true, lastCheck: Date.now() - 3 * day })
  assert.equal(midGrace.pro, true)
  assert.equal(midGrace.state, 'grace')
  // past the grace period: off until it can check in
  const expired = app.decide({ key, valid: true, lastCheck: Date.now() - (app.GRACE_DAYS * day + 1000) })
  assert.equal(expired.pro, false)
  assert.equal(expired.state, 'stale')

  // And the same through the real path, with the store on disk and the site unreachable: inside the
  // grace period Pro survives a flight; past it, the app falls back to the free version.
  await app.deactivate()
  await app.activate(key)
  const store = join(FAKE_HOME, '.laika', 'license.json')
  const ageTheCheckIn = (ms: number) => {
    const state = JSON.parse(readFileSync(store, 'utf8'))
    state.lastCheck = Date.now() - ms
    writeFileSync(store, JSON.stringify(state))
  }
  siteReachable = false
  try {
    ageTheCheckIn(3 * day)
    assert.equal((await app.status({ force: true })).pro, true, 'offline inside the grace period stays Pro')
    ageTheCheckIn(app.GRACE_DAYS * day + 1000)
    const out = await app.status({ force: true })
    assert.equal(out.pro, false, 'Pro should be off once the grace period has run out')
    assert.equal(out.state, 'stale')
  } finally {
    siteReachable = true
  }
})

// -------------------------------------------------- the key that actually ships

test('the public key shipped in the app is a usable Ed25519 key', () => {
  const pubFile = resolve(dirname(APP_LICENSE), 'license.pub')
  assert.ok(existsSync(pubFile), 'the app ships no licence public key, so no licence can ever verify')
  const pem = readFileSync(pubFile, 'utf8')
  const saved = process.env.ORBIT_LICENSE_PUBKEY
  process.env.ORBIT_LICENSE_PUBKEY = pem
  try {
    const pub = app.publicKey() as { asymmetricKeyType?: string } | null
    assert.ok(pub, 'the shipped licence public key does not parse')
    assert.equal(pub.asymmetricKeyType, 'ed25519')
    // Its private half is LICENSE_SIGNING_KEY, which lives only in the site's deployment env and is
    // deliberately not readable here. `npm run license:match` checks the pair where that key is set.
  } finally {
    process.env.ORBIT_LICENSE_PUBKEY = saved
  }
})
