/**
 * Vercel Web Analytics, on the same terms as the page-view beacon next door (see beacon.mjs).
 * Injected into every page, docs included, by the small integration in astro.config.mjs.
 *
 * Two things count views on this site and they are not the same thing. Vercel's numbers go to the
 * dashboard on vercel.com and are read by eye. Ours go to Orbit's Users panel, through the pulse
 * worker, because Vercel Web Analytics has no read API on this plan — which is the whole reason
 * the beacon exists. Neither knows about the other, and they count in different places (Vercel at
 * its edge, the beacon in the page), so their totals will be close but never identical.
 *
 * Under Global Privacy Control or Do Not Track, inject() is never called, so the analytics script
 * is never fetched at all — not fetched and then kept quiet.
 */
import { inject } from '@vercel/analytics'
import { askedNotToBeTracked, redact } from './analytics.mjs'

if (!askedNotToBeTracked(navigator, window)) {
  inject({ beforeSend: (event) => ({ ...event, url: redact(event.url) }) })
}
