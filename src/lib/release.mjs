/**
 * The current release of the free app, in one place, because these numbers appear on the home
 * page, the pricing page and the download section and must never disagree.
 *
 * Every value here was read off the release itself and checked against the artefact — the
 * checksums with `shasum -a 256 -c SHA256SUMS`, the minimum macOS from the built app's
 * Info.plist — rather than copied from a build script.
 *
 * `url` IS NOT SET YET, and the download button does not render until it is. v1.0.0 was first
 * published on a private repo, where every asset returns 404 to the public; it is being moved to
 * the public repo. Putting the real url here is the single change that turns the download on, and
 * `ready` below is what the pages check, so a half-finished move cannot ship a dead button.
 *
 * When the public url arrives, re-confirm the checksum against the asset actually served from it.
 * If the file was rebuilt rather than copied across, the hash below is stale and wrong.
 */
export const RELEASE = {
  version: '1.0.0',
  tag: 'v1.0.0',
  /** the public download url for the .dmg — fill this in to switch the download on */
  url: '',
  /** where the release itself lives, for people who want the notes and the other assets */
  page: '',
  file: 'LaikaOrbit-1.0.0-arm64.dmg',
  bytes: 360_499_772,
  sha256: 'c5c1fe33aafdfedf21673e32ae568b912197c7f50d3e11f3c063bfbe044ecf8b',
  /** Apple silicon only: there is no Intel build of 1.0.0 */
  arch: 'Apple silicon',
  minMacOS: '13',
  minMacOSName: 'Ventura',
}

/** the download is only shown when there is somewhere real to send people */
export const ready = Boolean(RELEASE.url)

/** "344 MB", the way a download size is normally written */
export const size = `${Math.round(RELEASE.bytes / 1_000_000)} MB`

/** "macOS 13 Ventura or later, Apple silicon" */
export const requirement = `macOS ${RELEASE.minMacOS} ${RELEASE.minMacOSName} or later, ${RELEASE.arch}`
