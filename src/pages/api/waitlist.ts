import type { APIRoute } from 'astro'
import { callerIp, LIMITS, overLimit, WINDOW } from '../../lib/rate-limit'
import { addContact, resendConfigured, sendConfirmation } from '../../lib/resend'
import { json } from '../../lib/stripe'

export const prerender = false

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * A public write endpoint, so it is deliberately dull: a hidden field bots fill in, a per-IP burst
 * limit, and one contact per address. Repeat sign-ups are told they are already on the list.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: { email?: unknown; company?: unknown }
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'expected JSON { email }' })
  }

  // honeypot: a field the form hides and people never see
  if (typeof body.company === 'string' && body.company.trim()) return json(200, { ok: true })

  const email = String(body.email ?? '').trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 254) return json(400, { error: 'That email address looks wrong.' })

  if (overLimit('waitlist', callerIp(request, clientAddress), LIMITS.waitlist, WINDOW)) {
    return json(429, { error: 'Too many sign-ups from here. Try again later.' })
  }

  if (!resendConfigured()) return json(503, { error: 'The waitlist is not switched on yet.' })

  try {
    const { alreadyOnList } = await addContact(email)
    if (!alreadyOnList) await sendConfirmation(email)
    return json(200, { ok: true, alreadyOnList })
  } catch (e) {
    console.error('waitlist', e)
    return json(502, { error: 'Could not add you right now. Try again in a minute.' })
  }
}
