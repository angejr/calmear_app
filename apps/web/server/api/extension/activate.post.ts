import { getRequestHeader } from 'h3'
import { consumePairingCode, createExtensionSession, checkActivateRateLimit } from '../../services/extension-auth'

/**
 * POST /api/extension/activate
 *
 * Activates a Chrome extension by consuming a one-time pairing code.
 * Returns a long-lived bearer token for the extension to store locally.
 *
 * This endpoint does NOT require a Clerk session — the extension isn't
 * logged into the website. The pairing code proves web-session authorization.
 *
 * Request body: { "code": "CALM-XXXX-XXXX" }
 * Response:     { "token": "...", "expiresAt": "..." }
 */
export default defineEventHandler(async (event) => {
  // Rate limiting by IP
  const ip =
    getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ??
    getRequestHeader(event, 'x-real-ip') ??
    'unknown'

  checkActivateRateLimit(ip)

  const body = await readBody(event)
  const rawCode = body?.code as string | undefined

  if (!rawCode || typeof rawCode !== 'string' || rawCode.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Pairing code is required.' })
  }

  // Validate and consume the pairing code
  const user = await consumePairingCode(rawCode)

  // Create a new long-lived extension session
  const { rawToken, expiresAt } = await createExtensionSession(user.id)

  return {
    token: rawToken,
    expiresAt: expiresAt.toISOString(),
  }
})
