import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * SHA-256 hash of a string, returned as a hex string.
 * Used to store pairing codes and extension tokens without keeping plaintext.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/**
 * Generates cryptographically secure random bytes, returned as a hex string.
 * Default: 32 bytes → 64-character hex string.
 */
export function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both inputs are hashed to equal-length buffers first.
 */
export function safeCompare(a: string, b: string): boolean {
  const ha = Buffer.from(sha256(a), 'hex')
  const hb = Buffer.from(sha256(b), 'hex')
  return timingSafeEqual(ha, hb)
}

/**
 * Generates a human-friendly pairing code in the format CALM-XXXX-XXXX
 * using uppercase alphanumeric characters (no ambiguous chars like O/0/I/1).
 */
export function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const pick = (n: number) =>
    Array.from(randomBytes(n))
      .map(b => chars[b % chars.length])
      .join('')
  return `CALM-${pick(4)}-${pick(4)}`
}

/**
 * Extracts the Bearer token from an Authorization header.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  return token.length > 0 ? token : null
}
