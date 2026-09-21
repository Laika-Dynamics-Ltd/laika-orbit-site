/**
 * Vercel Web Analytics ships on this site under two conditions that the package does not enforce
 * on its own, so they are checked here rather than trusted:
 *
 *   1. Under Global Privacy Control or Do Not Track, nothing is loaded at all — the analytics
 *      script is never even fetched.
 *   2. A recorded url never carries a query string. A finished checkout lands on
 *      /pro/success?session_id=cs_live_…, so the default behaviour would put a customer's Stripe
 *      session id into an analytics product.
 *   3. The one custom event the site sends, `download`, carries the release asset's filename and
 *      nothing else — and, like everything else here, is not sent at all under GPC or DNT.
 *
 * The first is watched at the network, on the built site:
 *
 *   cd .vercel/output/static && python3 -m http.server 4331 --bind 127.0.0.1
 *   node scripts/analytics-check.mjs
 */
import { chromium } from 'playwright'
import { askedNotToBeTracked, downloadProps, redact } from '../src/lib/analytics.mjs'
import { RELEASE } from '../src/lib/release.mjs'

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

// --- what a download event is allowed to say, without a browser ---
check(JSON.stringify(downloadProps(RELEASE.file)) === JSON.stringify({ asset: RELEASE.file }), 'a download event carries the asset name')
check(Object.keys(downloadProps(RELEASE.file)).join() === 'asset', 'and carries nothing besides the asset name')
check(downloadProps(`${RELEASE.file}?session_id=cs_live_a1B2c3D4`) === null, 'an asset name with a query string sends no event at all')
check(downloadProps('https://laikaorbit.com/pro/success') === null, 'anything url-shaped sends no event at all')
check(downloadProps('') === null && downloadProps(null) === null, 'an empty or missing asset name sends no event')

// --- the gate, at the network, on the built site ---
const browser = await chromium.launch()
// served from localhost, the package loads its debug script from va.vercel-scripts.com rather than
// /_vercel/insights/script.js; either one means "analytics is running", so both count
const ANALYTICS = /_vercel\/insights|va\.vercel-scripts\.com/
const load = async (path, init, press = false) => {
  const ctx = await browser.newContext({ userAgent: UA })
  // A click on a download button would otherwise start a 344 MB download from GitHub. The site's
  // own listener is on the capture phase, so it still runs before this cancels the navigation.
  if (press) await ctx.addInitScript(() => document.addEventListener('click', (e) => e.preventDefault()))
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  const asked = []
  const views = []
  const pending = []
  page.on('request', (r) => ANALYTICS.test(r.url()) && asked.push(r.url()))
  page.on('console', (m) => {
    if (m.text().includes('[view]')) views.push(m.text())
    // In debug mode nothing is sent, but the script logs the exact body it would have sent as one
    // of its console arguments. That object is the only honest view of what a custom event carries.
    if (m.text().includes('[event]')) pending.push(Promise.all(m.args().map((a) => a.jsonValue().catch(() => null))))
  })
  await page.goto(`${SITE}${path}`, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  if (press) {
    await page.click('[data-download]')
    await page.waitForTimeout(1500)
  }
  const events = (await Promise.all(pending)).map((args) => args.find((a) => a && typeof a === 'object' && a.en)).filter(Boolean)
  await ctx.close()
  return { asked, views, events }
}

const normal = await load(CHECKOUT)
check(normal.asked.length > 0, 'an ordinary visit does load the analytics script')
// the real proof of the redaction: what the running library says it recorded
check(normal.views.length > 0 && !normal.views.join(' ').includes('cs_live_'), 'the view it records carries no Stripe session id')

const GPC = () => Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true })
const gpc = await load(CHECKOUT, GPC)
check(gpc.asked.length === 0, 'under GPC the analytics script is never fetched')
const dnt = await load(CHECKOUT, () => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }))
check(dnt.asked.length === 0, 'under Do Not Track the analytics script is never fetched')

// --- the download event, at the button ---
// The click the site can see. GitHub's download_count is the other number and a different one;
// `npm run check:downloads` reads that. Nothing here tries to make them agree.
const pressed = await load('/', null, true)
const downloads = pressed.events.filter((e) => e.en === 'download')
check(downloads.length === 1, `pressing Download sends exactly one download event (sent ${downloads.length})`)
check(JSON.stringify(downloads[0]?.ed) === JSON.stringify({ asset: RELEASE.file }), `the event says only { asset: "${RELEASE.file}" }`)
check(!String(downloads[0]?.o ?? '?').includes('?'), 'the page url on the event carries no query string')

const gpcPressed = await load('/', GPC, true)
check(gpcPressed.asked.length === 0 && gpcPressed.events.length === 0, 'under GPC pressing Download sends nothing at all')

await browser.close()
process.exit(fail)
