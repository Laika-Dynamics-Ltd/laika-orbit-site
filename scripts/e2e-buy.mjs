/**
 * Buys Orbit Pro end to end in Stripe TEST mode: pricing page → Stripe Checkout with test card
 * 4242 → success page licence key → account page status. Needs the site running with SALES_OPEN=1
 * and test keys, plus `stripe listen --forward-to <BASE>/api/stripe/webhook`. See SALES.md.
 *   BASE=http://localhost:4321 OUT=/tmp/buy node scripts/e2e-buy.mjs
 */
import { chromium } from 'playwright'
const S = process.env.OUT ?? '.'
const BASE = process.env.BASE ?? 'http://localhost:4321'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
const step = async (name) => { await p.screenshot({ path: `${S}/${name}.png` }); console.log('step', name, p.url().slice(0, 60)) }
await p.goto(`${BASE}/pricing/`, { waitUntil: 'networkidle' })
await step('1-pricing')
await p.click('[data-checkout]')
await p.waitForURL(/checkout\.stripe\.com/, { timeout: 60000 })
// a dev server started from a folder whose .env holds a live key serves live sessions: never type a card into one
if (!/\/cs_test_/.test(p.url())) { console.error('not a test-mode session, stopping before any card is typed:', p.url().slice(0, 48)); process.exit(3) }
await p.waitForLoadState('networkidle')
await step('2-checkout')
const fill = async (sel, v) => { const el = p.locator(sel).first(); if (await el.count()) { await el.fill(v) } }
await fill('#email', 'orbit-e2e@example.com')
// card fields may be behind an accordion
const card = p.locator('[data-testid="card-accordion-item-button"]'); if (await card.count()) await card.click().catch(() => {})
await p.waitForSelector('#cardNumber', { timeout: 30000 })
await fill('#cardNumber', '4242424242424242')
await fill('#cardExpiry', '12 / 34')
await fill('#cardCvc', '123')
await fill('#billingName', 'Orbit Test')
const country = p.locator('#billingCountry'); if (await country.count()) await country.selectOption('NZ').catch(() => {})
await p.waitForTimeout(800)
await fill('#billingAddressLine1', '1 Queen Street')
await fill('#billingLocality', 'Auckland')
await fill('#billingPostalCode', '1010')
await step('3-filled')
await p.locator('button[type="submit"], [data-testid="hosted-payment-submit-button"]').first().click()
await p.waitForURL(/\/pro\/success/, { timeout: 90000 })
await p.waitForSelector('[data-key]:not([value=""])', { state: 'attached', timeout: 60000 })
await p.waitForFunction(() => document.querySelector('[data-key]')?.value?.startsWith('LO1.'), null, { timeout: 60000 })
await step('4-success')
const key = await p.inputValue('[data-key]')
;(await import('node:fs')).writeFileSync(`${S}/license-key.txt`, key, { mode: 0o600 }) // test-mode key only
console.log('licence key issued:', key.slice(0, 12) + '…', 'length', key.length)
await p.goto(`${BASE}/pro/account/`, { waitUntil: 'networkidle' })
await p.click('form[data-form] button[type="submit"]')
await p.waitForFunction(() => /Active|Not active/.test(document.querySelector('[data-note]')?.textContent ?? ''), null, { timeout: 30000 })
console.log('account page says:', await p.textContent('[data-note]'))
await step('5-account')
await b.close()
