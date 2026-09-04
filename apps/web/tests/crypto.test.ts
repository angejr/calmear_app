import { describe, it, expect } from 'vitest'
import { sha256, randomHex, generatePairingCode, safeCompare } from '../server/utils/crypto'

describe('sha256', () => {
  it('returns a 64-character hex string', () => {
    const hash = sha256('hello world')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('produces consistent output for same input', () => {
    expect(sha256('test')).toBe(sha256('test'))
  })

  it('produces different output for different inputs', () => {
    expect(sha256('a')).not.toBe(sha256('b'))
  })
})

describe('randomHex', () => {
  it('generates a hex string of correct length', () => {
    const hex = randomHex(32)
    expect(hex).toHaveLength(64) // 32 bytes = 64 hex chars
    expect(hex).toMatch(/^[0-9a-f]+$/)
  })

  it('generates different values each call', () => {
    expect(randomHex()).not.toBe(randomHex())
  })

  it('respects custom byte length', () => {
    expect(randomHex(48)).toHaveLength(96)
  })
})

describe('generatePairingCode', () => {
  it('matches the CALM-XXXX-XXXX format', () => {
    const code = generatePairingCode()
    expect(code).toMatch(/^CALM-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  })

  it('generates different codes each call', () => {
    expect(generatePairingCode()).not.toBe(generatePairingCode())
  })
})

describe('safeCompare', () => {
  it('returns true for identical strings', () => {
    expect(safeCompare('hello', 'hello')).toBe(true)
  })

  it('returns false for different strings', () => {
    expect(safeCompare('hello', 'world')).toBe(false)
  })
})
