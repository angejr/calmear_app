import { describe, expect, it } from 'vitest'
import { isRateLimited, parseFeedback } from '../server/services/feedback'

describe('parseFeedback', () => {
  it('accepts an uninstall reason with the extension version', () => {
    expect(parseFeedback({ source: 'uninstall', reason: 'price', message: '', email: '', extensionVersion: '1.0.2' })).toEqual({
      ok: true,
      value: { source: 'uninstall', reason: 'price', message: null, email: null, extensionVersion: '1.0.2' },
    })
  })

  it('accepts a message without a choice, trimmed and capped', () => {
    const parsed = parseFeedback({ source: 'feedback', message: `  ${'a'.repeat(3000)}  `, email: ' me@example.com ' })
    expect(parsed.ok).toBe(true)
    if (parsed.ok === true) {
      expect(parsed.value.message).toHaveLength(2000)
      expect(parsed.value.email).toBe('me@example.com')
      expect(parsed.value.reason).toBeNull()
    }
  })

  it('requires a choice or a message', () => {
    expect(parseFeedback({ source: 'feedback', message: '   ' })).toEqual({ ok: false, error: 'Choose an option or write a message.' })
  })

  it('only accepts the choices of the matching form', () => {
    expect(parseFeedback({ source: 'feedback', reason: 'price' }).ok).toBe(false)
    expect(parseFeedback({ source: 'uninstall', reason: 'bug' }).ok).toBe(false)
    expect(parseFeedback({ source: 'feedback', reason: 'bug' }).ok).toBe(true)
  })

  it('rejects an unknown source and a malformed email', () => {
    expect(parseFeedback({ source: 'admin', message: 'hi' }).ok).toBe(false)
    expect(parseFeedback(null).ok).toBe(false)
    expect(parseFeedback({ source: 'feedback', message: 'hi', email: 'not-an-email' }).ok).toBe(false)
  })

  it('drops an extension version that does not look like one', () => {
    const parsed = parseFeedback({ source: 'uninstall', reason: 'other', extensionVersion: '<script>' })
    expect(parsed.ok === true && parsed.value.extensionVersion).toBeNull()
  })

  it('flags a filled honeypot as spam', () => {
    expect(parseFeedback({ source: 'feedback', message: 'hi', website: 'http://spam.example' })).toEqual({ ok: 'spam' })
  })
})

describe('isRateLimited', () => {
  it('allows 5 submissions per address in 10 minutes', () => {
    const t0 = 1_000_000
    for (let i = 0; i < 5; i++) expect(isRateLimited('203.0.113.1', t0 + i)).toBe(false)
    expect(isRateLimited('203.0.113.1', t0 + 10)).toBe(true)
    expect(isRateLimited('203.0.113.2', t0 + 10)).toBe(false)
    expect(isRateLimited('203.0.113.1', t0 + 10 * 60 * 1000 + 5)).toBe(false)
  })
})
