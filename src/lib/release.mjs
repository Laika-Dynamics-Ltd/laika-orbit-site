/**
 * The current release of the free app, in one place, because these numbers appear on the home
 * page, the pricing page and the download section and must never disagree.
 *
 * Every value here was read off the release itself and checked against the artefact — the
 * checksums with `shasum -a 256 -c SHA256SUMS`, the minimum macOS from the built app's
 * Info.plist — rather than copied from a build script.
 *
 * v1.0.0 was first published on a private repo, where every asset returned 404 to the public, and
 * has since been moved to Laika-Dynamics-Ltd/laika-orbit. Each release is checked with
 * `pnpm release:verify v<x.y.z>` in laika-orbit, which fetches the published bytes, hashes them,
 * mounts the DMG and asserts the app inside is Developer ID signed, hardened, notarised and
 * stapled — a local file with a release's name once hashed differently, so nothing here comes from disk.
 *
 * `ready` is what the pages check. Empty the url and the whole download disappears from the site
 * rather than turning into a dead button.
 */
export const RELEASE = {
  version: '1.0.3',
  tag: 'v1.0.3',
  /** the public download url for the .dmg — fill this in to switch the download on */
  url: 'https://github.com/Laika-Dynamics-Ltd/laika-orbit/releases/download/v1.0.3/LaikaOrbit-1.0.3-universal.dmg',
  /** where the release itself lives, for people who want the notes and the other assets */
  page: 'https://github.com/Laika-Dynamics-Ltd/laika-orbit/releases/tag/v1.0.3',
  file: 'LaikaOrbit-1.0.3-universal.dmg',
  bytes: 650_509_290,
  sha256: 'f1592d04c104d396c8e1878e051c731247b2e8a4cc88901be78f567fec06806b',
  /** one universal build: Apple silicon, and Intel, which has never been tested (no Intel Mac here) */
  arch: 'Apple silicon and Intel',
  /**
   * True, checked on the app inside the published dmg (the one whose sha256 matches the line
   * below — there is an older, unsigned build of the same version and filename lying around, and
   * checking that one instead is how this briefly got recorded as false):
   *   codesign -dv   Authority=Developer ID Application: Joe Sealey (HB8K7XP52D), flags=runtime
   *   spctl -a -t exec -vv   accepted, source=Notarized Developer ID
   *   xcrun stapler validate   The validate action worked!
   * Stapled, so Gatekeeper accepts it offline and the first open is clean.
   *
   * From 1.0.2 the dmg container is signed, notarised and stapled as well as the app inside it
   * (package-mac.mjs); 1.0.0 and 1.0.1 only had the app done.
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

/**
 * The Windows installer of the same release.
 *
 * Beside the Mac release rather than inside it, because the two are not the same kind of download
 * and the page has to say so: the Mac build is signed, notarised and universal, and this one is an
 * early x64 build that Windows itself warns about. The numbers came the same way — the size off
 * the published asset, the digest off the release's own SHA256SUMS, never off a local file.
 *
 * Empty the url (or the size, or the digest) and Windows disappears from the site, exactly as the
 * Mac download does, rather than becoming a dead button.
 */
export const WINDOWS = {
  version: '1.0.3',
  tag: 'v1.0.3',
  url: 'https://github.com/Laika-Dynamics-Ltd/laika-orbit/releases/download/v1.0.3/LaikaOrbit-1.0.3-x64-setup.exe',
  file: 'LaikaOrbit-1.0.3-x64-setup.exe',
  bytes: 0,
  sha256: '',
  /** x64 only: there is no arm64 Windows build, so an ARM PC is not served at all */
  arch: '64-bit (x64)',
  /**
   * False, and Windows will say so: there is no Windows code-signing certificate, so SmartScreen
   * shows "Windows protected your PC" the first time Setup.exe runs. The checksum on the page is
   * what stands in for a signature until there is one.
   */
  signed: false,
  minWindows: '10',
  /**
   * Early, and the page says it in as many words rather than in a footnote. The installer runs and
   * serves the real UI, but secrets are not kept in a keychain on Windows, so anything needing a
   * stored credential is not safe to rely on there, and no automated check runs on Windows at all:
   * it is built and exercised by hand on one machine. The app's README says the same.
   */
  early: true,
}

/** the Windows download is shown only once there is a real file, with a real size and digest */
export const windowsReady = Boolean(WINDOWS.url && WINDOWS.bytes && WINDOWS.sha256)

/** "412 MB", written the way the Mac size is */
export const windowsSize = `${Math.round(WINDOWS.bytes / 1_000_000)} MB`

/** "Windows 10 or later, 64-bit (x64)" */
export const windowsRequirement = `Windows ${WINDOWS.minWindows} or later, ${WINDOWS.arch}`
