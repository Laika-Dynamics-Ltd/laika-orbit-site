#!/usr/bin/env node
/**
 * Do the site's downloads — the Mac disk image, and the Windows installer when there is one —
 * describe the artefacts GitHub actually serves?
 *
 *   npm run check:release
 *
 * src/lib/release.mjs is the one place the download's version, url, size and sha256 live, and
 * every one of those numbers was copied there by hand off a release. The failure this catches is
 * publishing a new version and leaving the site pointing at the old one — people are then offered
 * a download that is not the release just announced, and nothing on the site looks wrong.
 *
 * It is deliberately built around the digest rather than the filename. Every build of every
 * version is called LaikaOrbit-<version>-arm64.dmg, several of them exist across worktrees and
 * dist/ directories at once, and an unsigned build of the same version and filename has already
 * been mistaken for the published one here. The name proves nothing; the sha256 does.
 *
 * So it reads the digest from the SHA256SUMS asset that GitHub serves to the public, unauthenticated
 * and with no gh login, because the question is what a visitor receives — not what this machine
 * happens to hold. The download url itself is then range-requested to prove it really resolves for
 * someone who is not us.
 *
 * Nothing here is downloaded in full: SHA256SUMS is a few hundred bytes and the dmg is asked for
 * one byte.
 *
 * Exit: 0 match, 1 mismatch, 2 could not check.
 */
import { RELEASE, WINDOWS, ready, windowsReady } from '../src/lib/release.mjs'

/** One line out, and nothing else, ever. */
const done = (line, code) => {
  ;(code === 0 ? console.log : console.error)(line)
  process.exit(code)
}
const cannotCheck = (why) => done(`release: CANNOT CHECK — ${why}`, 2)
const mismatch = (why) => done(`release: MISMATCH — ${why}`, 1)

// An empty url is a deliberate state, not a fault: it switches the whole download off rather than
// leaving a dead button. There is then nothing being offered, so there is nothing to check.
if (!ready) done('release: OFF — no download url is set, so the site offers no Mac download', 0)

const parts = new URL(RELEASE.url).pathname.split('/').filter(Boolean)
const [owner, repo, kind, sub, tag, file] = parts
if (kind !== 'releases' || sub !== 'download' || !tag || !file)
  cannotCheck(`RELEASE.url is not a GitHub release asset url (${RELEASE.url})`)
if (tag !== RELEASE.tag) mismatch(`RELEASE.url points at ${tag} but RELEASE.tag says ${RELEASE.tag}`)
if (file !== RELEASE.file) mismatch(`RELEASE.url ends in ${file} but RELEASE.file says ${RELEASE.file}`)

const get = async (url, init) => {
  try {
    return await fetch(url, { redirect: 'follow', ...init })
  } catch (e) {
    cannotCheck(`${url} could not be reached (${e.message})`)
  }
}

// The public API, with no token: a release that is still a draft, or in a private repo, answers 404
// here exactly as it does for a visitor — which is the answer that matters.
// The API root is overridable so the checks below can be exercised against a stub: the only way to
// see the BEHIND branch fire while this repo has exactly one published release.
const API = process.env.GITHUB_API ?? 'https://api.github.com'
const api = `${API}/repos/${owner}/${repo}/releases/tags/${tag}`
const r = await get(api, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'laika-orbit-site check:release' } })
if (r.status === 403 || r.status === 429) cannotCheck('the GitHub API rate-limited this check; try again shortly')
if (r.status === 404) mismatch(`GitHub serves no public release ${tag} for ${owner}/${repo} — a draft or private release is a 404 to everyone else too`)
if (!r.ok) cannotCheck(`the GitHub API answered ${r.status} for ${tag}`)
const release = await r.json()
if (release.draft) mismatch(`${tag} is still a draft on GitHub, so its assets are not public`)

const asset = release.assets?.find((a) => a.name === RELEASE.file)
if (!asset) mismatch(`${tag} has no asset named ${RELEASE.file} (it has: ${(release.assets ?? []).map((a) => a.name).join(', ') || 'nothing'})`)
if (asset.size !== RELEASE.bytes) mismatch(`${RELEASE.file} on ${tag} is ${asset.size} bytes, but RELEASE.bytes says ${RELEASE.bytes}`)

const sums = release.assets?.find((a) => a.name === 'SHA256SUMS')
if (!sums) cannotCheck(`${tag} publishes no SHA256SUMS asset, so there is no published digest to check against`)
const s = await get(sums.browser_download_url, { headers: { 'user-agent': 'laika-orbit-site check:release' } })
if (!s.ok) cannotCheck(`SHA256SUMS on ${tag} answered ${s.status}`)
const text = await s.text()
const line = text
  .split('\n')
  .map((l) => l.trim())
  .find((l) => !l.startsWith('#') && l.endsWith(` ${RELEASE.file}`))
if (!line) mismatch(`SHA256SUMS on ${tag} has no line for ${RELEASE.file}`)
const published = line.split(/\s+/)[0]
if (published !== RELEASE.sha256)
  mismatch(`${RELEASE.file} on ${tag} has sha256 ${published}, but RELEASE.sha256 says ${RELEASE.sha256} — the site is describing a different build of the same filename`)

// One byte, to prove the url a visitor clicks actually resolves rather than 404ing from a private
// repo or a renamed asset. 206 is the honest answer; 200 means the range was ignored, which is fine.
const head = await get(RELEASE.url, { headers: { range: 'bytes=0-0', 'user-agent': 'laika-orbit-site check:release' } })
if (!head.ok) mismatch(`the download url answers ${head.status} to an unauthenticated request, so the public cannot fetch it`)

// The Windows installer gets the same three questions, when the site offers one: the release has an
// asset by that name, it is the size and the digest release.mjs claims, and the url resolves for
// someone who is not us. A second download, not an alternative — the page offers both at once, so
// either being wrong is the same failure.
let winLine = null
if (windowsReady) {
  const winParts = new URL(WINDOWS.url).pathname.split('/').filter(Boolean)
  const [, , , , winTag, winFile] = winParts
  if (winTag !== tag)
    mismatch(`WINDOWS.url points at ${winTag} but the Mac download is on ${tag} — one release, one tag`)
  if (winFile !== WINDOWS.file) mismatch(`WINDOWS.url ends in ${winFile} but WINDOWS.file says ${WINDOWS.file}`)
  const win = release.assets?.find((a) => a.name === WINDOWS.file)
  if (!win)
    mismatch(`${tag} has no asset named ${WINDOWS.file} (it has: ${(release.assets ?? []).map((a) => a.name).join(', ') || 'nothing'})`)
  if (win.size !== WINDOWS.bytes) mismatch(`${WINDOWS.file} on ${tag} is ${win.size} bytes, but WINDOWS.bytes says ${WINDOWS.bytes}`)
  const wl = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => !l.startsWith('#') && l.endsWith(` ${WINDOWS.file}`))
  if (!wl) mismatch(`SHA256SUMS on ${tag} has no line for ${WINDOWS.file}`)
  const winPublished = wl.split(/\s+/)[0]
  if (winPublished !== WINDOWS.sha256)
    mismatch(`${WINDOWS.file} on ${tag} has sha256 ${winPublished}, but WINDOWS.sha256 says ${WINDOWS.sha256} — the site is describing a different build of the same filename`)
  const winHead = await get(WINDOWS.url, { headers: { range: 'bytes=0-0', 'user-agent': 'laika-orbit-site check:release' } })
  if (!winHead.ok)
    mismatch(`the Windows download url answers ${winHead.status} to an unauthenticated request, so the public cannot fetch it`)
  winLine = `${WINDOWS.file}, ${win.size} bytes, sha256 ${winPublished.slice(0, 12)}…`
}

// Everything above proves the site describes a real artefact correctly. It does not prove it
// describes the *current* one, and that is the likelier mistake: publish a new version, forget this
// file, and every check still passes because the old release is still served. /releases/latest is
// what GitHub calls newest, ignoring drafts and prereleases.
const l = await get(`${API}/repos/${owner}/${repo}/releases/latest`, {
  headers: { accept: 'application/vnd.github+json', 'user-agent': 'laika-orbit-site check:release' },
})
if (l.ok) {
  const latest = (await l.json()).tag_name
  if (latest && latest !== RELEASE.tag)
    done(
      `release: BEHIND — the site offers ${RELEASE.tag}, correctly, but ${latest} is the latest public release. Point src/lib/release.mjs at ${latest} before deploying, or say here why ${RELEASE.tag} is deliberate.`,
      1,
    )
}

done(
  `release: MATCH — ${owner}/${repo} ${tag} serves ${RELEASE.file}, ${asset.size} bytes, sha256 ${published.slice(0, 12)}…${winLine ? ` and ${winLine}` : ''}, and the url${winLine ? 's' : ''} resolve${winLine ? '' : 's'} publicly`,
  0,
)
