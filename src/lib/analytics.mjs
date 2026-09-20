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
