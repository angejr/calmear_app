import { useDb } from '../utils/db'
import { getAppVersion } from '../utils/version'
import { feedback } from '../../drizzle/schema'
import { FEEDBACK_LIMITS, FEEDBACK_TOPICS, UNINSTALL_REASONS } from '../../config/feedback'
import type { FeedbackSource } from '../../config/feedback'

export interface FeedbackInput {
  source: FeedbackSource
  reason: string | null
  message: string | null
  email: string | null
  extensionVersion: string | null
}

export type ParsedFeedback =
  | { ok: true, value: FeedbackInput }
  | { ok: false, error: string }
  /** Honeypot filled in: pretend it worked, store nothing */
  | { ok: 'spam' }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VERSION_RE = /^[0-9][0-9A-Za-z.-]*$/

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

/**
 * Validates a form submission. Pure, so it can be unit tested.
 * A form must carry at least a reason or a message.
 */
export function parseFeedback(body: unknown): ParsedFeedback {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>

  if (typeof b.website === 'string' && b.website.trim()) return { ok: 'spam' }

  if (b.source !== 'feedback' && b.source !== 'uninstall') return { ok: false, error: 'Invalid form.' }
  const source: FeedbackSource = b.source

  const allowed = (source === 'feedback' ? FEEDBACK_TOPICS : UNINSTALL_REASONS).map(o => o.key as string)
  const reason = typeof b.reason === 'string' && allowed.includes(b.reason) ? b.reason : null
  if (b.reason != null && b.reason !== '' && !reason) return { ok: false, error: 'Invalid choice.' }

  const message = cleanText(b.message, FEEDBACK_LIMITS.message)
  if (!reason && !message) return { ok: false, error: 'Choose an option or write a message.' }

  const email = cleanText(b.email, FEEDBACK_LIMITS.email)
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: 'This email address doesn\'t look right.' }

  const v = cleanText(b.extensionVersion, FEEDBACK_LIMITS.extensionVersion)
  const extensionVersion = v && VERSION_RE.test(v) ? v : null

  return { ok: true, value: { source, reason, message, email, extensionVersion } }
}

// ---------------------------------------------------------------------------
// Rate limit: a few submissions per address per window. In memory, so it is
// per machine and reset on deploy; enough to stop a form being flooded.
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const _recent = new Map<string, number[]>()

export function isRateLimited(key: string, now = Date.now()): boolean {
  const kept = (_recent.get(key) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (kept.length >= RATE_LIMIT_MAX) {
    _recent.set(key, kept)
    return true
  }
  kept.push(now)
  _recent.set(key, kept)
  // Keep the map from growing without bound
  if (_recent.size > 10_000) {
    for (const [k, times] of _recent) {
      if (times.every(t => now - t >= RATE_LIMIT_WINDOW_MS)) _recent.delete(k)
    }
  }
  return false
}

export async function saveFeedback(input: FeedbackInput): Promise<void> {
  const db = useDb()
  await db.insert(feedback).values({ ...input, version: getAppVersion() })
}
