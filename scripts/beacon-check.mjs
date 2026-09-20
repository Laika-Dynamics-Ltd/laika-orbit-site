/**
 * Does the beacon in the BUILT site actually count a page view? The one thing a unit test cannot
 * answer, because the answer depends on a real browser running a real page against a real worker.
 *
 * It needs three things running, none of them Cloudflare:
 *
 *   1. the pulse worker, with .dev.vars carrying PULSE_READ_TOKEN and DEV_ORIGIN=http://localhost:4331
 *        cd ../laika-orbit/tools/pulse-ingest && npx wrangler dev --local --port 8831
 *   2. this site, built with the endpoint pointing at it
 *        PUBLIC_PULSE_ENDPOINT=http://127.0.0.1:8831 pnpm build
 *   3. that build, served on 4331
 *        cd .vercel/output/static && python3 -m http.server 4331 --bind 127.0.0.1
 *
 *   node scripts/beacon-check.mjs
 *
 * Run it before a deploy that changes the beacon, the layout or the Starlight head. It is what
 * caught the two `head` keys in astro.config.mjs silently dropping the beacon from every docs page.
 */
import { chromium } from 'playwright'

const SITE = 'http://localhost:4331'
const WORKER = 'http://127.0.0.1:8831'
const TOKEN = 'local-only-not-a-secret'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

const views = async () => {
  const r = await fetch(`${WORKER}/v1/pulse?days=7`, { headers: { authorization: `Bearer ${TOKEN}` } })
  const d = await r.json()
  return { total: d.site.reduce((a, x) => a + x.views, 0), paths: Object.fromEntries(d.sitePaths.map((p) => [p.path, p.views])) }
}

const browser = await chromium.launch()
const visit = async (path, init) => {
  const ctx = await browser.newContext({ userAgent: UA })
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  await page.goto(`${SITE}${path}`, { waitUntil: 'load' })
  await page.waitForTimeout(1200) // sendBeacon is fire-and-forget; give it a moment to leave
  await ctx.close()
}

let fail = 0
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS ' : 'FAIL '} ${msg}`)
  if (!ok) fail = 1
}

const a = await views()
await visit('/')
await visit('/docs/') // the pages the duplicate `head` key had been skipping entirely
await visit('/built-with-orbit/')
const b = await views()
check(b.total === a.total + 3, `three real page loads counted themselves (${a.total} -> ${b.total})`)
check((b.paths['/docs/'] ?? 0) > (a.paths['/docs/'] ?? 0), 'a docs page counted its own view')

await visit('/', () => Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true }))
const c = await views()
check(c.total === b.total, 'Global Privacy Control: nothing sent, nothing counted')

await visit('/', () => Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' }))
const d = await views()
check(d.total === c.total, 'Do Not Track: nothing sent, nothing counted')

await visit('/') // control: proves the two checks above were suppression, not a dead harness
const e = await views()
check(e.total === d.total + 1, `control visit still counts (${d.total} -> ${e.total})`)

await browser.close()
process.exit(fail)
