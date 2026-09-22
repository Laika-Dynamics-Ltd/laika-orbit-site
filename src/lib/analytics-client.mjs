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
 * It also sends one custom event, `download`, when someone presses a download button: the click
 * the site can see. The download itself is counted on the server, when /download/<file> hands
 * out the redirect (src/lib/download-hit.mjs), and the file GitHub actually served only
 * `npm run check:downloads` can tell us. The three are meant to differ — the gaps are people who
 * pressed and never finished — so none is corrected against another.
 *
 * The event carries the asset's filename and nothing else. No url, no referrer, nothing about the
 * person; downloadProps() in analytics.mjs is what enforces that.
 *
 * Under Global Privacy Control or Do Not Track, inject() is never called, so the analytics script
 * is never fetched at all — not fetched and then kept quiet — and the listener below is never
 * attached, so a download click is exactly as silent as a page load.
 */
import { inject, track } from '@vercel/analytics'
import { askedNotToBeTracked, downloadProps, redact } from './analytics.mjs'

if (!askedNotToBeTracked(navigator, window)) {
  inject({ beforeSend: (event) => ({ ...event, url: redact(event.url) }) })

  // One listener on the document rather than a handler per button: every page that renders a
  // download is counted without remembering to wire it, the same way the beacon does it. Capture,
  // so the navigation away cannot beat us to it.
  document.addEventListener(
    'click',
    (e) => {
      try {
        const el = e.target?.closest?.('[data-download]')
        if (!el) return
        const props = downloadProps(el.getAttribute('data-download'))
        if (props) track('download', props)
      } catch {
        // counting a click must never be able to break the click
      }
    },
    true,
  )
}
