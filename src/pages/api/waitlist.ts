import type { APIRoute } from 'astro'
import { optional } from '../../lib/env'
import { json } from '../../lib/stripe'

export const prerender = false

/** Waitlist sign-up: POST { email, plan? } → stored as a Resend audience contact. */
export const POST: APIRoute = async ({ request }) => {
  let email = ''
  try {
    email = String((await request.json()).email ?? '').trim().toLowerCase()
  } catch {
    return json(400, { error: 'expected JSON { email }' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) return json(400, { error: 'that email address looks wrong' })
  const apiKey = optional('RESEND_API_KEY')
  const audience = optional('RESEND_AUDIENCE_ID')
  if (!apiKey || !audience) return json(503, { error: 'The waitlist is not switched on yet.' })
  const r = await fetch(`https://api.resend.com/audiences/${audience}/contacts`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, unsubscribed: false }),
  })
  if (!r.ok && r.status !== 409) {
    console.error('waitlist', r.status, await r.text().catch(() => ''))
    return json(502, { error: 'Could not add you right now. Try again in a minute.' })
  }
  return json(200, { ok: true })
}
