/**
 * The counted download: what /download and /download/<file> send to the pulse worker, and when
 * they send nothing. Pure functions, plain headers, no server and no network — the one fetch is
 * a fake that records its argument.
 *
 * Run: npm test
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { country, downloadHit, downloadTarget, optedOut, referrerHost, sendHit } from '../src/lib/download-hit.mjs'
import { RELEASE } from '../src/lib/release.mjs'

const h = (o: Record<string, string> = {}) => new Headers(o)

test('/download resolves to the current release, and a named asset to itself', () => {
  assert.deepEqual(downloadTarget(), { file: RELEASE.file, url: RELEASE.url })
  assert.deepEqual(downloadTarget(RELEASE.file), { file: RELEASE.file, url: RELEASE.url })
})

test('a name that is not a release asset is null, never a guess', () => {
  assert.equal(downloadTarget('LaikaOrbit-9.9.9-arm64.dmg'), null)
  assert.equal(downloadTarget('../etc/passwd'), null)
  assert.equal(downloadTarget(RELEASE.file.toUpperCase()), null)
})

test('the hit is the path of the file, the referring host and a country — nothing else', () => {
  const hit = downloadHit(RELEASE.file, h({ referer: 'https://news.ycombinator.com/item?id=1', 'x-vercel-ip-country': 'gb', 'user-agent': 'Mozilla/5.0' }))
  assert.deepEqual(hit, { path: `/download/${RELEASE.file}`, ref: 'news.ycombinator.com', country: 'GB' })
})

test('a visitor who asked not to be tracked is not counted, by either header', () => {
  assert.equal(downloadHit(RELEASE.file, h({ 'sec-gpc': '1' })), null)
  assert.equal(downloadHit(RELEASE.file, h({ dnt: '1' })), null)
  assert.equal(optedOut(h({ dnt: '0' })), false)
})

test('our own pages are not a referral, and a bad referer is nothing', () => {
  assert.equal(referrerHost(h({ referer: 'https://laikaorbit.com/pricing' })), '')
  assert.equal(referrerHost(h({ referer: 'https://laika-orbit-site.vercel.app/' })), '')
  assert.equal(referrerHost(h({ referer: 'not a url' })), '')
  assert.equal(referrerHost(h()), '')
})

test('a country is two letters or nothing', () => {
  assert.equal(country(h({ 'x-vercel-ip-country': 'DE' })), 'DE')
  assert.equal(country(h({ 'x-vercel-ip-country': 'Germany' })), '')
  assert.equal(country(h()), '')
})

test('sendHit posts the hit as the site, forwards the agent for the bot filter, and never throws', async () => {
  const calls: any[] = []
  const fetchImpl = async (url: string, init: any) => {
    calls.push({ url, init })
    return { status: 204 } as Response
  }
  const hit = { path: '/download/x.dmg', ref: '', country: 'GB' }
  assert.equal(await sendHit('https://w.test/', hit, 'Mozilla/5.0', { fetchImpl: fetchImpl as any }), true)
  assert.equal(calls[0].url, 'https://w.test/v1/hit')
  assert.equal(calls[0].init.headers.origin, 'https://laikaorbit.com')
  assert.equal(calls[0].init.headers['user-agent'], 'Mozilla/5.0')
  assert.equal(calls[0].init.body, JSON.stringify(hit))
  // no endpoint, no hit, or a worker that is down: false, and the download still goes ahead
  assert.equal(await sendHit('', hit, '', { fetchImpl: fetchImpl as any }), false)
  assert.equal(await sendHit('https://w.test', null, '', { fetchImpl: fetchImpl as any }), false)
  assert.equal(await sendHit('https://w.test', hit, '', { fetchImpl: (async () => { throw new Error('down') }) as any }), false)
  assert.equal(calls.length, 1)
})
