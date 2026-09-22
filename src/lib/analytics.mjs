/**
 * The two rules Vercel Web Analytics is held to on this site. Pure, and side-effect free, so they
 * can be checked without a browser; src/lib/analytics-client.mjs is what applies them.
 *
 * Vercel Web Analytics sets no cookie and keeps no persistent identifier, so it asks for no consent
 * banner. Neither of the rules below is something it does on its own.
 */

/**
 * The page, never its query or fragment — the same rule the beacon follows.
 *
 * Not tidiness: a finished checkout lands on /pro/success?session_id=cs_live_…, and the default
 * records the url as it stands, so without this a customer's Stripe checkout session id would be
 * sitting in an analytics product. Anything else ever put in a query string is covered too.
 */
export const redact = (url) => String(url).split(/[?#]/)[0]

/** true when the visitor's browser has asked not to be tracked, by either of the two ways it can */
export const askedNotToBeTracked = (nav, win) => Boolean(nav?.globalPrivacyControl || nav?.doNotTrack === '1' || win?.doNotTrack === '1')

/**
 * What a click on the download button is allowed to report to Vercel Web Analytics: the name of
 * the asset, and nothing else. null means send no event at all.
 *
 * The allowed shape is deliberately narrow — letters, digits, dot, dash, underscore — which is
 * every release filename we publish and nothing that could carry a query string, a path or a
 * visitor. The value is written into the markup from src/lib/release.mjs, so today it can only be
 * a filename; this is here so that stays true if anyone ever points that attribute at something
 * derived from the page instead.
 */
export const downloadProps = (asset) => {
  const name = String(asset ?? '').trim()
  return name && name.length <= 120 && /^[A-Za-z0-9._-]+$/.test(name) ? { asset: name } : null
}
