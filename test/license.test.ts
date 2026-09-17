import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateSigningKeys, newLicenseId, publicKeyFor, signLicense, verifyLicense, type LicensePayload } from '../src/lib/license.ts'

const { privatePem, publicPem } = generateSigningKeys()
const payload: LicensePayload = { v: 1, lid: newLicenseId(), sub: 'sub_123', cus: 'cus_456', plan: 'pro', iat: 1789600000 }

test('a signed key verifies and round-trips its payload', () => {
  const key = signLicense(payload, privatePem)
  assert.match(key, /^LO1\.[\w-]+\.[\w-]+$/)
  assert.deepEqual(verifyLicense(key, publicPem), payload)
  assert.deepEqual(verifyLicense(key, publicKeyFor(privatePem)), payload)
})

test('the same payload always gives the same key (Ed25519 is deterministic)', () => {
  assert.equal(signLicense(payload, privatePem), signLicense(payload, privatePem))
})

test('base64 of the PEM works as the signing key, as it is stored in env vars', () => {
  const b64 = Buffer.from(privatePem).toString('base64')
  assert.deepEqual(verifyLicense(signLicense(payload, b64), publicPem), payload)
})

test('a tampered payload, a foreign key and junk are all rejected', () => {
  const key = signLicense(payload, privatePem)
  const [p, , s] = key.split('.')
  const forged = Buffer.from(JSON.stringify({ ...payload, sub: 'sub_someone_else' })).toString('base64url')
  assert.equal(verifyLicense(`${p}.${forged}.${s}`, publicPem), null)
  assert.equal(verifyLicense(key, generateSigningKeys().publicPem), null)
  for (const junk of ['', 'LO1', 'LO1..', 'LO2.a.b', 'not a key', `${key}x`]) assert.equal(verifyLicense(junk, publicPem), null)
})
