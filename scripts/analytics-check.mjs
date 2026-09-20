/**
 * Vercel Web Analytics ships on this site under two conditions that the package does not enforce
 * on its own, so they are checked here rather than trusted:
 *
 *   1. Under Global Privacy Control or Do Not Track, nothing is loaded at all — the analytics
 *      script is never even fetched.
 *   2. A recorded url never carries a query string. A finished checkout lands on
 *      /pro/success?session_id=cs_live_…, so the default behaviour would put a customer's Stripe
 *      session id into an analytics product.
 *
 * The first is watched at the network, on the built site:
 *
 *   cd .vercel/output/static && python3 -m http.server 4331 --bind 127.0.0.1
 *   node scripts/analytics-check.mjs
 */
import { chromium } from 'playwright'
import { askedNotToBeTracked, redact } from '../src/lib/analytics.mjs'

const SITE = 'http://localhost:4331'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const CHECKOUT = '/pro/success/?session_id=cs_live_a1B2c3D4e5F6g7H8'

let fail = 0
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS ' : 'FAIL '} ${msg}`)
  if (!ok) fail = 1
}

// --- the redaction, without a browser ---
check(redact(`https://laikaorbit.com${CHECKOUT}`) === 'https://laikaorbit.com/pro/success/', 'a checkout url loses its Stripe session id')
check(!redact(`https://laikaorbit.com${CHECKOUT}`).includes('cs_live_'), 'no cs_live_ id survives redaction')
check(redact('https://laikaorbit.com/docs/#install') === 'https://laikaorbit.com/docs/', 'a fragment is dropped too')

// --- the gate, as pure logic ---
check(askedNotToBeTracked({ globalPrivacyControl: true }, {}) === true, 'Global Privacy Control is honoured')
check(askedNotToBeTracked({ doNotTrack: '1' }, {}) === true, 'Do Not Track on the navigator is honoured')
check(askedNotToBeTracked({}, { doNotTrack: '1' }) === true, 'Do Not Track on the window is honoured')
check(askedNotToBeTracked({}, {}) === false, 'an ordinary visitor is counted')

// --- the gate, at the network, on the built site ---
const browser = await chromium.launch()
// served from localhost, the package loads its debug script from va.vercel-scripts.com rather than
// /_vercel/insights/script.js; either one means "analytics is running", so both count
const ANALYTICS = /_vercel\/insights|va\.vercel-scripts\.com/
const load = async (path, init) => {
  const ctx = await browser.newContext({ userAgent: UA })
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  const asked = []
  const views = []
  page.on('request', (r) => ANALYTICS.test(r.url()) && asked.push(r.url()))
  page.on('console', (m) => m.text().includes('[view]') && views.push(m.text()))
  await page.goto(`${SITE}${path}`, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  await ctx.close()
  return { asked, views }
}

const normal = await load(CHECKOUT)
check(normal.asked.length > 0, 'an ordinary visit does load the analytics script')
// the real proof of the redaction: what the running library says it recorded
check(normal.views.length > 0 && !normal.views.join(' ').includes('cs_live_'), 'the view it records carries no Stripe session id')

const gpc = await load(CHECKOUT, () => Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }))
check(gpc.asked.length === 0, 'under GPC the analytics script is never fetched')
const dnt = await load(CHECKOUT, () => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }))
check(dnt.asked.length === 0, 'under Do Not Track the analytics script is never fetched')

await browser.close()
process.exit(fail)
