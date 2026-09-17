#!/usr/bin/env node
/**
 * Creates (or finds) the waitlist audience in Resend and prints its id for RESEND_AUDIENCE_ID.
 * The id is not a secret; the API key is. Pass the key in the environment, never on the command line:
 *
 *   RESEND_API_KEY=… node scripts/resend-setup.mjs            # default name: Laika Orbit waitlist
 *   RESEND_API_KEY=… node scripts/resend-setup.mjs "Some name"
 */
const key = process.env.RESEND_API_KEY
if (!key) throw new Error('set RESEND_API_KEY in the environment')
const name = process.argv[2] ?? 'Laika Orbit waitlist'
const api = async (path, init = {}) => {
  const r = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`${path} → ${r.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : {}
}

const existing = (await api('/audiences')).data ?? []
const found = existing.find((a) => a.name === name)
const audience = found ?? (await api('/audiences', { method: 'POST', body: JSON.stringify({ name }) }))
console.log(`${found ? 'found' : 'created'} audience "${name}"`)
console.log(`RESEND_AUDIENCE_ID=${audience.id}`)

const domains = (await api('/domains')).data ?? []
const verified = domains.filter((d) => d.status === 'verified')
console.log(
  verified.length
    ? `verified sending domains: ${verified.map((d) => d.name).join(', ')} — set RESEND_FROM, e.g. "Laika Orbit <hello@${verified[0].name}>"`
    : 'no verified sending domain yet: sign-ups are stored, but no confirmation email is sent until RESEND_FROM works',
)
