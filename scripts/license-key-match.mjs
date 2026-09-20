#!/usr/bin/env node
/**
 * Does the licence key the app ships match the key the site signs with?
 *
 *   LICENSE_SIGNING_KEY="…" npm run license:match
 *   npm run license:match -- /path/to/laika-orbit/packages/app/license.pub
 *
 * The test suite proves the two halves of the chain agree on the *format*, using a throwaway pair.
 * It cannot prove the production pair, because the private half only exists in the deployment
 * environment. This does, wherever that key is set — a deploy shell, or `vercel env pull`.
 *
 * It derives the public half of LICENSE_SIGNING_KEY and compares it to the public key baked into
 * the app. If they differ, every licence the site issues is rejected by every copy of the app.
 *
 * Only public keys are ever printed. The private key is read, never shown.
 */
import { createPrivateKey, createPublicKey } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const pubFile = process.argv[2] ?? resolve(HERE, '../../laika-orbit/packages/app/license.pub')

const signing = process.env.LICENSE_SIGNING_KEY?.trim()
if (!signing) {
  console.error('LICENSE_SIGNING_KEY is not set in this shell, so there is nothing to compare.')
  console.error('Run it where that key lives (the deployment env), or after `vercel env pull`.')
  process.exit(2)
}
if (!existsSync(pubFile)) {
  console.error(`No public key at ${pubFile}. Pass the path to the app's license.pub as an argument.`)
  process.exit(2)
}

let derived
try {
  const pem = signing.includes('BEGIN') ? signing : Buffer.from(signing, 'base64').toString('utf8')
  derived = createPublicKey(createPrivateKey(pem)).export({ type: 'spki', format: 'pem' }).toString().trim()
} catch (e) {
  console.error(`LICENSE_SIGNING_KEY is not a private key this can read: ${e.message}`)
  console.error('It should be an Ed25519 PKCS#8 PEM, or the base64 of one, as scripts/license-keygen.mjs writes.')
  process.exit(2)
}

const shipped = createPublicKey(readFileSync(pubFile, 'utf8')).export({ type: 'spki', format: 'pem' }).toString().trim()

console.log(`signing key's public half:\n${derived}`)
console.log(`shipped in the app (${pubFile}):\n${shipped}`)

if (derived === shipped) {
  console.log('MATCH — licences this key signs will verify in the app.')
  process.exit(0)
}
console.error('MISMATCH — every licence this key signs will be rejected by the app.')
console.error('Ship the public half above as packages/app/license.pub, or set the signing key that matches what the app already ships.')
process.exit(1)
