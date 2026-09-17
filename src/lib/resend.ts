/**
 * Resend: the waitlist audience and the confirmation email.
 *
 *   RESEND_API_KEY       re_… (Resend → API keys; "Sending access" is enough once a domain is verified)
 *   RESEND_AUDIENCE_ID   the audience the waitlist writes to (pnpm resend:setup prints it)
 *   RESEND_FROM          optional, e.g. "Laika Orbit <hello@laikaorbit.com>". Without it, no
 *                        confirmation email is sent — sending needs a verified domain.
 */
import { optional } from './env'

const API = 'https://api.resend.com'

export const resendConfigured = () => Boolean(optional('RESEND_API_KEY') && optional('RESEND_AUDIENCE_ID'))

async function call(path: string, init: RequestInit) {
  const key = optional('RESEND_API_KEY')
  if (!key) throw new Error('RESEND_API_KEY is not set')
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  const body = await r.text()
  return { ok: r.ok, status: r.status, body }
}

/**
 * Adds a contact, and says whether they were already on the list. Resend upserts rather than
 * returning a conflict, so the address is looked up first: otherwise a second sign-up would send a
 * second confirmation email.
 */
export async function addContact(email: string) {
  const audience = optional('RESEND_AUDIENCE_ID')
  if (!audience) throw new Error('RESEND_AUDIENCE_ID is not set')
  const path = `/audiences/${audience}/contacts`
  const existing = await call(`${path}/${encodeURIComponent(email)}`, { method: 'GET' })
  if (existing.ok) return { alreadyOnList: true }

  const r = await call(path, { method: 'POST', body: JSON.stringify({ email, unsubscribed: false }) })
  if (!r.ok && r.status !== 409) throw new Error(`resend contacts ${r.status}: ${r.body.slice(0, 200)}`)
  return { alreadyOnList: r.status === 409 }
}

/** Confirms the sign-up, if a verified sender is configured. Never throws: the sign-up still counts. */
export async function sendConfirmation(email: string) {
  const from = optional('RESEND_FROM')
  if (!from) return { sent: false, reason: 'RESEND_FROM not set' }
  try {
    const r = await call('/emails', {
      method: 'POST',
      body: JSON.stringify({
        from,
        to: [email],
        subject: "You're on the Laika Orbit Pro waitlist",
        text: [
          "Thanks for signing up. You're on the list for Laika Orbit Pro.",
          '',
          'Pro adds the signed, notarised Mac app with automatic updates and email support',
          'answered within 2 working days. Sync across your Macs is being built: we are aiming for',
          'the first half of 2027, and it lands for founding members at no extra cost.',
          '',
          'Laika Orbit itself is free and open source, and you can run it today:',
          'https://laikaorbit.com/docs/getting-started/',
          '',
          "We'll email you once when Pro opens. Nothing else.",
          '',
          '— Laika Dynamics',
        ].join('\n'),
      }),
    })
    if (!r.ok) console.error('waitlist confirmation', r.status, r.body.slice(0, 200))
    return { sent: r.ok }
  } catch (e) {
    console.error('waitlist confirmation', e)
    return { sent: false }
  }
}
