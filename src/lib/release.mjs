/**
 * The current release of the free app, in one place, because these numbers appear on the home
 * page, the pricing page and the download section and must never disagree.
 *
 * Every value here was read off the release itself and checked against the artefact — the
 * checksums with `shasum -a 256 -c SHA256SUMS`, the minimum macOS from the built app's
 * Info.plist — rather than copied from a build script.
 *
 * v1.0.0 was first published on a private repo, where every asset returned 404 to the public, and
 * has since been moved to Laika-Dynamics-Ltd/laika-orbit. v1.0.1 (21 Sep 2026) was checked with
 * `pnpm release:verify v1.0.1` in laika-orbit on 22 Sep, which fetches the published bytes, hashes
 * them, mounts the DMG and asserts the app inside is Developer ID signed, hardened, notarised and
 * stapled — a local file with the release's name hashed differently, so nothing here comes from disk.
 *
 * `ready` is what the pages check. Empty the url and the whole download disappears from the site
 * rather than turning into a dead button.
 */
export const RELEASE = {
  version: '1.0.1',
  tag: 'v1.0.1',
  /** the public download url for the .dmg — fill this in to switch the download on */
  url: 'https://github.com/Laika-Dynamics-Ltd/laika-orbit/releases/download/v1.0.1/LaikaOrbit-1.0.1-arm64.dmg',
  /** where the release itself lives, for people who want the notes and the other assets */
  page: 'https://github.com/Laika-Dynamics-Ltd/laika-orbit/releases/tag/v1.0.1',
  file: 'LaikaOrbit-1.0.1-arm64.dmg',
  bytes: 365_987_406,
  sha256: '7f3623f4cabd0025ef558064fe57cf056346fb7bec147968001e26695b4b25cb',
  /** Apple silicon only: there is no Intel build of 1.0.1 */
  arch: 'Apple silicon',
  /**
   * True, checked on the app inside the published dmg (the one whose sha256 matches the line
   * below — there is an older, unsigned build of the same version and filename lying around, and
   * checking that one instead is how this briefly got recorded as false):
   *   codesign -dv   Authority=Developer ID Application: Joe Sealey (HB8K7XP52D), flags=runtime
   *   spctl -a -t exec -vv   accepted, source=Notarized Developer ID
   *   xcrun stapler validate   The validate action worked!
   * Stapled, so Gatekeeper accepts it offline and the first open is clean.
   *
   * The dmg container itself is not signed or stapled — only the app inside is. Gatekeeper judges
   * the app, so this does not affect anyone opening it; worth fixing in a later build, not worth
   * re-cutting for; still true of 1.0.1.
   */
  signed: true,
  minMacOS: '13',
  minMacOSName: 'Ventura',
}

/** the download is only shown when there is somewhere real to send people */
export const ready = Boolean(RELEASE.url)

/** "344 MB", the way a download size is normally written */
export const size = `${Math.round(RELEASE.bytes / 1_000_000)} MB`

/** "macOS 13 Ventura or later, Apple silicon" */
export const requirement = `macOS ${RELEASE.minMacOS} ${RELEASE.minMacOSName} or later, ${RELEASE.arch}`
