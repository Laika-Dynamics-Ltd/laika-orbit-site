#!/usr/bin/env node
/**
 * Make the Ed25519 key pair that signs Orbit Pro licences.
 *   node scripts/license-keygen.mjs <out-dir>
 * Writes license-signing.pem (private; goes into LICENSE_SIGNING_KEY as base64) and
 * license-verify.pem (public; ships inside the app). Never commit the private key.
 */
import { generateKeyPairSync } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2]
if (!out) throw new Error('usage: license-keygen.mjs <out-dir>')
mkdirSync(out, { recursive: true, mode: 0o700 })
const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const priv = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
writeFileSync(join(out, 'license-signing.pem'), priv, { mode: 0o600 })
writeFileSync(join(out, 'license-verify.pem'), publicKey.export({ type: 'spki', format: 'pem' }).toString())
writeFileSync(join(out, 'LICENSE_SIGNING_KEY.base64'), Buffer.from(priv).toString('base64'), { mode: 0o600 })
console.log(`wrote ${out}/license-signing.pem, license-verify.pem and LICENSE_SIGNING_KEY.base64`)
