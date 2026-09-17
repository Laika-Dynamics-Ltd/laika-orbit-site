/**
 * Orbit Pro licence keys: `LO1.<payload>.<signature>`, base64url, signed with Ed25519.
 *
 * The payload names the Stripe subscription and customer, so a key proves which subscription it
 * belongs to without a database: the site checks the subscription's live status with Stripe, and
 * the app can verify the signature offline with the public key and fall back to a grace period
 * when it can't reach the site.
 */
import { createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign, verify, type KeyObject } from 'node:crypto'

export interface LicensePayload {
  v: 1
  lid: string // licence id, also stored on the subscription's metadata
  sub: string // Stripe subscription id
  cus: string // Stripe customer id
  plan: 'pro'
  iat: number // issued at, epoch seconds
}

const PREFIX = 'LO1'
const b64u = (buf: Buffer) => buf.toString('base64url')

function privateKey(pem: string): KeyObject {
  const text = pem.includes('BEGIN') ? pem : Buffer.from(pem, 'base64').toString('utf8')
  return createPrivateKey(text)
}

export function newLicenseId(): string {
  return `lic_${randomUUID().replaceAll('-', '')}`
}

export function signLicense(payload: LicensePayload, signingKeyPem: string): string {
  const body = b64u(Buffer.from(JSON.stringify(payload)))
  const sig = sign(null, Buffer.from(`${PREFIX}.${body}`), privateKey(signingKeyPem))
  return `${PREFIX}.${body}.${b64u(sig)}`
}

/** The payload if the signature is valid for this key, else null. Never throws on bad input. */
export function verifyLicense(key: string, publicKey: KeyObject | string): LicensePayload | null {
  try {
    const [prefix, body, sig] = String(key).trim().split('.')
    if (prefix !== PREFIX || !body || !sig) return null
    const pub = typeof publicKey === 'string' ? createPublicKey(publicKey) : publicKey
    if (!verify(null, Buffer.from(`${PREFIX}.${body}`), pub, Buffer.from(sig, 'base64url'))) return null
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as LicensePayload
    return p.v === 1 && p.plan === 'pro' && p.sub && p.cus && p.lid ? p : null
  } catch {
    return null
  }
}

export function publicKeyFor(signingKeyPem: string): KeyObject {
  return createPublicKey(privateKey(signingKeyPem))
}

/** For setup: a fresh signing key pair as PEM strings. */
export function generateSigningKeys(): { privatePem: string; publicPem: string } {
  const { privateKey: pk, publicKey: pub } = generateKeyPairSync('ed25519')
  return {
    privatePem: pk.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicPem: pub.export({ type: 'spki', format: 'pem' }).toString(),
  }
}
