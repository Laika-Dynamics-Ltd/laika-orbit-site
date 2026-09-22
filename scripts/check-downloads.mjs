#!/usr/bin/env node
/**
 * How many people have actually downloaded the app?
 *
 *   npm run check:downloads
 *
 * GitHub counts a download of every release asset and reports it as `download_count` on the
 * releases API. That number is the truth: it counts everyone who got the file, whether they
 * pressed Download on laikaorbit.com or went straight to the releases page, and it keeps counting
 * for old versions long after the site has moved on.
 *
 * It is deliberately not the same number as the download clicks in Vercel Web Analytics, and the
 * two are not meant to agree. A click there is someone on the marketing page pressing the button;
 * a count here is a file that left GitHub. The gap between them is the interesting part — people
 * who pressed and never finished, and people who never saw the site at all — so the two are kept
 * apart rather than reconciled. See src/lib/analytics-client.mjs for the other half.
 *
 * Like check:release this runs unauthenticated, with no gh login, because the counts on a public
 * release are public. Unauthenticated GitHub allows 60 requests an hour per IP, which is many more
 * runs than anyone needs; a 403 here is almost always that limit.
 *
 * What is counted: the artefacts a person installs (.dmg, .zip, .pkg). SHA256SUMS, blockmaps and
 * update manifests are listed but left out of the total — an updater fetching a manifest is not a
 * download, and counting it would quietly inflate the only number anyone quotes.
 *
 * Exit: 0 read, 2 could not read.
 */
import { RELEASE } from '../src/lib/release.mjs'

const die = (why) => {
  console.error(`downloads: CANNOT READ — ${why}`)
  process.exit(2)
}

// The repo comes from the same module the site's download button does, so this can never end up
// reporting on a different repo than the one being offered.
const source = RELEASE.url || RELEASE.page
if (!source) die('src/lib/release.mjs has neither a url nor a release page, so there is no repo to ask about')
const [owner, repo] = new URL(source).pathname.split('/').filter(Boolean)
if (!owner || !repo) die(`could not read an owner/repo out of ${source}`)

const API = process.env.GITHUB_API ?? 'https://api.github.com'
const headers = { accept: 'application/vnd.github+json', 'user-agent': 'laika-orbit-site check:downloads' }

let r
try {
  // 100 releases is far more than this project will have before someone revisits this line; the
  // API paginates past that and we would silently report only the newest hundred.
  r = await fetch(`${API}/repos/${owner}/${repo}/releases?per_page=100`, { headers })
} catch (e) {
  die(`${API} could not be reached (${e.message})`)
}
if (r.status === 403 || r.status === 429) die('the GitHub API rate-limited this check; try again shortly')
if (r.status === 404) die(`GitHub serves no public releases for ${owner}/${repo} — a private repo answers 404 here too`)
if (!r.ok) die(`the GitHub API answered ${r.status}`)

const releases = (await r.json()).filter((rel) => !rel.draft)
if (!releases.length) die(`${owner}/${repo} has no published releases`)

/** the artefacts a person installs; everything else is machinery around them */
const isApp = (name) => /\.(dmg|zip|pkg)$/i.test(name)

let total = 0
const lines = []
for (const rel of releases.sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))) {
  const marks = [rel.prerelease && 'prerelease', rel.tag_name === RELEASE.tag && 'offered on the site'].filter(Boolean)
  lines.push(`${rel.tag_name}${marks.length ? ` (${marks.join(', ')})` : ''}`)
  const assets = rel.assets ?? []
  if (!assets.length) lines.push('       — no assets')
  for (const a of assets.sort((x, y) => y.download_count - x.download_count)) {
    const app = isApp(a.name)
    if (app) total += a.download_count
    lines.push(`  ${String(a.download_count).padStart(5)}  ${a.name}${app ? '' : '   (not an app download, not in the total)'}`)
  }
}

console.log(`downloads: ${owner}/${repo}, read ${new Date().toISOString()}`)
console.log('')
console.log(lines.join('\n'))
console.log('')
console.log(`total app downloads, all releases: ${total}`)
console.log('This is the real count, including people who never touched laikaorbit.com. For how many')
console.log("pressed Download on the site, read the 'download' custom event in Vercel Web Analytics.")
