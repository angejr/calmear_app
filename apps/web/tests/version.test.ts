import { describe, it, expect } from 'vitest'
import { deriveVersionFromClerkKey } from '../server/utils/version'

describe('deriveVersionFromClerkKey', () => {
  it('returns production for Clerk live keys', () => {
    expect(deriveVersionFromClerkKey('pk_live_Y2xlcmsuZXhhbXBsZS5jb20k')).toBe('production')
  })

  it('returns development for Clerk test keys', () => {
    expect(deriveVersionFromClerkKey('pk_test_ZGV2LmNsZXJrLmFjY291bnRzLmRldiQ')).toBe('development')
  })

  it('returns development for a missing key', () => {
    expect(deriveVersionFromClerkKey(undefined)).toBe('development')
    expect(deriveVersionFromClerkKey(null)).toBe('development')
    expect(deriveVersionFromClerkKey('')).toBe('development')
  })

  it('is strict about the pk_live_ prefix', () => {
    expect(deriveVersionFromClerkKey('pk_liv_almost')).toBe('development')
    expect(deriveVersionFromClerkKey('PK_LIVE_wrongcase')).toBe('development')
    expect(deriveVersionFromClerkKey('sk_live_secret_key')).toBe('development')
  })
})
