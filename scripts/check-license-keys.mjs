#!/usr/bin/env node
/**
 * Do the two halves of the licence chain hold the same key?
 *
 *   npm run check:license-keys
 *
 * The site signs Orbit Pro licences with LICENSE_SIGNING_KEY; the app accepts a licence only if it
 * was signed by the public key the app ships. If those two are not halves of one pair, every
 * purchase takes the money and hands over a key the app rejects — and the test suite still passes,
 * because the tests sign with a throwaway pair and can only prove the two repos agree on the
 * *format*, never on the production key.
 *
 * So this is the last unproven link in the chain, and it belongs in the deploy path rather than in
 * someone's memory: run it wherever the real signing key lives, and refuse the deploy on non-zero.
 *
 * It reads LICENSE_SIGNING_KEY from the environment only — never from a file in this repo — and
 * never prints, logs or returns any part of it, of the key derived from it, or of the key it is
 * compared against: not the value, not a prefix, not a length. The entire output is one line. On a
 * mismatch it names the two sources that disagreed, not what they held.
 *
 * Exit: 0 match, 1 mismatch, 2 could not check.
 */
import { createPrivateKey, createPublicKey } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_LICENSE = process.env.ORBIT_APP_LICENSE ?? resolve(HERE, '../../laika-orbit/packages/app/license.mjs')

/** One line out, and nothing else, ever. */
const done = (line, code) => {
  ;(code === 0 ? console.log : console.error)(line)
  process.exit(code)
}
const cannotCheck = (why) => done(`license keys: CANNOT CHECK — ${why}`, 2)

if (!process.env.LICENSE_SIGNING_KEY?.trim()) cannotCheck('LICENSE_SIGNING_KEY is not set in this environment')
if (!existsSync(APP_LICENSE)) cannotCheck(`the app's licence module was not found at ${APP_LICENSE} (set ORBIT_APP_LICENSE)`)

// The app's own resolution, so this compares against the key the app will really use: the
// ORBIT_LICENSE_PUBKEY override where it is set, otherwise the license.pub baked into the build.
const { publicKey: appPublicKey } = await import(APP_LICENSE)
const appSource = process.env.ORBIT_LICENSE_PUBKEY?.trim() ? 'ORBIT_LICENSE_PUBKEY' : resolve(dirname(APP_LICENSE), 'license.pub')

const shipped = appPublicKey()
if (!shipped) cannotCheck(`the app has no usable licence public key (${appSource})`)

let derived
try {
  const signing = process.env.LICENSE_SIGNING_KEY.trim()
  const pem = signing.includes('BEGIN') ? signing : Buffer.from(signing, 'base64').toString('utf8')
  derived = createPublicKey(createPrivateKey(pem))
} catch {
  // The underlying error is deliberately swallowed rather than reported: nothing that was computed
  // from the signing key leaves this process, not even an error string that quotes it.
  cannotCheck('LICENSE_SIGNING_KEY could not be read as an Ed25519 private key (PKCS#8 PEM, or the base64 of one)')
}

// Compare the keys themselves, not their text, so PEM wrapping or a stray newline is never
// mistaken for a mismatch.
const der = (k) => k.export({ type: 'spki', format: 'der' })
if (der(derived).equals(der(shipped))) done('license keys: MATCH', 0)

done(`license keys: MISMATCH — LICENSE_SIGNING_KEY in this environment is not the private half of ${appSource}, so the app would reject every licence signed here`, 1)
