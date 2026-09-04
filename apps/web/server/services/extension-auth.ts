import { eq, and, gt, isNull } from 'drizzle-orm'
import { createError } from 'h3'
import { useDb } from '../utils/db'
import { extensionPairingCodes, extensionSessions, users } from '../../drizzle/schema'
import { sha256, randomHex, generatePairingCode } from '../utils/crypto'
export { extractBearerToken } from '../utils/crypto'
import type { User } from '../../drizzle/schema'

/** Extension sessions expire after 365 days by default */
const SESSION_TTL_DAYS = 365
/** Pairing codes expire after 10 minutes */
const PAIRING_CODE_TTL_MINUTES = 10

// ---------------------------------------------------------------------------
// Simple in-memory rate limiting for /api/extension/activate
// MVP-grade: resets on server restart, not distributed.
// TODO: Replace with Redis/Upstash rate limiting for production scaling.
// ---------------------------------------------------------------------------
const activateAttempts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10

export function checkActivateRateLimit(ip: string): void {
  const now = Date.now()
  const entry = activateAttempts.get(ip)
  if (!entry || entry.resetAt < now) {
    activateAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return
  }
  entry.count++
  if (entry.count > RATE_LIMIT_MAX) {
    throw createError({ statusCode: 429, statusMessage: 'Too many activation attempts. Please wait a minute.' })
  }
}

// ---------------------------------------------------------------------------
// Pairing codes
// ---------------------------------------------------------------------------

export async function createPairingCode(userId: string): Promise<{ rawCode: string; expiresAt: Date }> {
  const db = useDb()
  const rawCode = generatePairingCode()
  const codeHash = sha256(rawCode)
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MINUTES * 60 * 1000)
  await db.insert(extensionPairingCodes).values({ userId, codeHash, expiresAt })
  return { rawCode, expiresAt }
}

export async function consumePairingCode(rawCode: string): Promise<User> {
  const db = useDb()
  const codeHash = sha256(rawCode.trim().toUpperCase())
  const now = new Date()

  const [pairingCode] = await db
    .select()
    .from(extensionPairingCodes)
    .where(and(
      eq(extensionPairingCodes.codeHash, codeHash),
      isNull(extensionPairingCodes.consumedAt),
      gt(extensionPairingCodes.expiresAt, now),
    ))
    .limit(1)

  if (!pairingCode) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid, expired, or already-used pairing code.' })
  }

  await db.update(extensionPairingCodes)
    .set({ consumedAt: now })
    .where(eq(extensionPairingCodes.id, pairingCode.id))

  const [user] = await db.select().from(users).where(eq(users.id, pairingCode.userId)).limit(1)
  if (!user) throw createError({ statusCode: 500, statusMessage: 'User not found.' })
  return user
}

// ---------------------------------------------------------------------------
// Extension sessions / bearer tokens
// ---------------------------------------------------------------------------

export async function createExtensionSession(userId: string): Promise<{ rawToken: string; expiresAt: Date }> {
  const db = useDb()
  const rawToken = randomHex(48)
  const tokenHash = sha256(rawToken)
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  await db.insert(extensionSessions).values({ userId, tokenHash, expiresAt })
  return { rawToken, expiresAt }
}

export async function resolveExtensionToken(rawToken: string): Promise<User> {
  const db = useDb()
  const tokenHash = sha256(rawToken)
  const now = new Date()

  const [session] = await db
    .select()
    .from(extensionSessions)
    .where(and(
      eq(extensionSessions.tokenHash, tokenHash),
      isNull(extensionSessions.revokedAt),
      gt(extensionSessions.expiresAt, now),
    ))
    .limit(1)

  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid, expired, or revoked extension token.' })
  }

  // Fire-and-forget last_used update
  db.update(extensionSessions)
    .set({ lastUsedAt: now })
    .where(eq(extensionSessions.id, session.id))
    .catch(() => {})

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'User not found for this token.' })
  return user
}

export async function revokeExtensionToken(rawToken: string): Promise<void> {
  const db = useDb()
  const tokenHash = sha256(rawToken)
  await db.update(extensionSessions)
    .set({ revokedAt: new Date() })
    .where(eq(extensionSessions.tokenHash, tokenHash))
}


