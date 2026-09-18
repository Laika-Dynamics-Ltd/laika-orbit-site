/**
 * The share image (public/og.png): the top of the homepage at 1200×630, as the site draws it.
 *
 *   pnpm dev --port 5611 &  node scripts/og-image.mjs [http://localhost:5611/]
 *
 * Re-run it whenever the hero's words change, so shared links never show old copy.
 */
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5611/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'networkidle' })
// the sticky nav would sit over the hero; the image is the hero alone
await page.addStyleTag({ content: 'body > header.nav { display: none !important }' })
await page.waitForTimeout(2500)
await page.screenshot({ path: fileURLToPath(new URL('../public/og.png', import.meta.url)) })
await browser.close()
console.log('wrote public/og.png from', url)
