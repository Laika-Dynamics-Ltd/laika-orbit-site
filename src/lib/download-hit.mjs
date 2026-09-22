/**
 * The download redirect, counted on the server.
 *
 * The site does not link to GitHub straight from the button any more. It links to /download (the
 * current release) or /download/<file> (a named asset), which counts one "download started" at
 * the pulse worker and then sends the browser on to GitHub with a 302. That count lands in the
 * same daily table as page views, at the path `/download/<file>`, so the Users panel reads it
 * without a second store, and the file it names says which release was taken.
 *
 * Why on the server rather than in the page: the click listeners in beacon.mjs and
 * analytics-client.mjs are silent under Do Not Track, blocked by content blockers, and lost when
 * the navigation beats the beacon; GitHub's own download_count is the truth for files served but
 * has no day, no referrer and no country. This is the number in between — what a person asked
 * for, counted the same way as a page view. The two rules the beacon keeps are kept here:
 *
 *   · a visitor who has asked not to be tracked (Sec-GPC or DNT) is redirected and not counted
 *   · nothing but a day, the asset, the referring host and a country is sent, never an IP or UA
 *     in the record. The user agent is forwarded to the worker for its bot filter, which reads it
 *     and stores nothing.
 *
 * Pure, so `npm test` can drive it with plain headers and no server.
 */
import { RELEASE, ready } from './release.mjs'

/** the assets a person may ask for by name, and where each one lives */
const ASSETS = () => (ready ? new Map([[RELEASE.file, RELEASE.url]]) : new Map())

/**
 * Where /download or /download/<file> goes, or null for a name that is not a release asset — a
 * 404 rather than a guess, so a typo can never be counted as a download.
 */
export function downloadTarget(file) {
  if (!ready) return null
  if (file === undefined || file === null || file === '') return { file: RELEASE.file, url: RELEASE.url }
  const url = ASSETS().get(String(file))
  return url ? { file: String(file), url } : null
}

/** true when the request carries either of the two ways a browser says "do not track me" */
export const optedOut = (headers) => headers.get('sec-gpc') === '1' || headers.get('dnt') === '1'

/** the referring host, never the full URL, and never our own site */
export function referrerHost(headers) {
  try {
    const h = new URL(headers.get('referer') ?? '').hostname.toLowerCase()
    return h && !h.endsWith('laikaorbit.com') && !h.endsWith('laika-orbit-site.vercel.app') ? h : ''
  } catch {
    return ''
  }
}

/** Vercel's country header; two letters or nothing */
export function country(headers) {
  const c = String(headers.get('x-vercel-ip-country') ?? '').toUpperCase()
  return /^[A-Z]{2}$/.test(c) ? c : ''
}

/** the hit to send for a download of `file`, or null when this visitor is not to be counted */
export function downloadHit(file, headers) {
  if (optedOut(headers)) return null
  return { path: `/download/${file}`, ref: referrerHost(headers), country: country(headers) }
}

/**
 * Post one hit to the worker. Awaited by the route, with a short timeout, so the count cannot be
 * lost when the function is torn down after the redirect; a worker that is slow or down costs at
 * most the timeout and never the download.
 */
export async function sendHit(endpoint, hit, ua, { fetchImpl = fetch, timeoutMs = 1500 } = {}) {
  if (!endpoint || !hit) return false
  try {
    const r = await fetchImpl(`${String(endpoint).replace(/\/+$/, '')}/v1/hit`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', origin: 'https://laikaorbit.com', 'user-agent': ua || 'laikaorbit.com/download' },
      body: JSON.stringify(hit),
      signal: AbortSignal.timeout(timeoutMs),
    })
    return r.status === 204
  } catch {
    return false
  }
}
