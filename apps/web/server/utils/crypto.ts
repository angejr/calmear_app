import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * SHA-256 hash of a string, returned as a hex string.
 * Used to store authorization codes and extension tokens without keeping plaintext.
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
 * Extracts the Bearer token from an Authorization header.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  return token.length > 0 ? token : null
}
