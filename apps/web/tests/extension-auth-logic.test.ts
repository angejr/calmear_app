import { describe, it, expect } from 'vitest'
import { extractBearerToken, sha256, generatePairingCode } from '../server/utils/crypto'

/**
 * Unit tests for extension authentication logic that can run without a database.
 * Integration tests (consume/create in DB) are covered by the acceptance test flow.
 */

describe('extractBearerToken', () => {
  it('extracts token from valid Authorization header', () => {
    const token = extractBearerToken('Bearer abc123')
    expect(token).toBe('abc123')
  })

  it('returns null for missing header', () => {
    expect(extractBearerToken(undefined)).toBeNull()
  })

  it('returns null for wrong scheme', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull()
  })

  it('returns null for empty token', () => {
    expect(extractBearerToken('Bearer ')).toBeNull()
  })

  it('handles token with spaces after Bearer', () => {
    const token = extractBearerToken('Bearer   my-token')
    expect(token).toBe('my-token')
  })
})

describe('pairing code format and hashing', () => {
  it('pairing codes have correct format', () => {
    for (let i = 0; i < 10; i++) {
      const code = generatePairingCode()
      expect(code).toMatch(/^CALM-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    }
  })

  it('same raw code always hashes to same value', () => {
    const code = 'CALM-TEST-CODE'
    expect(sha256(code)).toBe(sha256(code))
  })

  it('different codes produce different hashes', () => {
    const a = 'CALM-AAAA-BBBB'
    const b = 'CALM-CCCC-DDDD'
    expect(sha256(a)).not.toBe(sha256(b))
  })
})

describe('token hashing security', () => {
  it('raw token and its hash are never equal', () => {
    const raw = 'my-super-secret-extension-token'
    const hash = sha256(raw)
    expect(raw).not.toBe(hash)
  })

  it('hash length is always 64 characters regardless of input', () => {
    expect(sha256('short')).toHaveLength(64)
    expect(sha256('a'.repeat(1000))).toHaveLength(64)
  })
})
