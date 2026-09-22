import { getRequestHeader } from 'h3'
import { consumeAuthCode, createExtensionSession, checkTokenRateLimit } from '../../services/extension-auth'

/**
 * POST /api/extension/token
 *
 * Exchanges a short-lived, single-use authorization code (issued by the
 * authenticated web app) for a long-lived CalmEar extension bearer token.
 *
 * Authentication: NONE — the authorization code itself is the credential.
 * The code is single-use, short-lived (2 minutes), and hashed server-side.
 *
 * Request body: { "code": "..." }
 * Response:     { "token": "...", "expiresAt": "..." }
 */
export default defineEventHandler(async (event) => {
  // Rate limiting by IP
  const ip =
    getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ??
    getRequestHeader(event, 'x-real-ip') ??
    'unknown'

  checkTokenRateLimit(ip)

  const body = await readBody(event)
  const rawCode = body?.code as string | undefined

  if (!rawCode || typeof rawCode !== 'string' || rawCode.trim().length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Authorization code is required.' })
  }

  // Validate and consume the authorization code
  const user = await consumeAuthCode(rawCode)

  // Create a new long-lived extension session
  const { rawToken, expiresAt } = await createExtensionSession(user.id)

  return {
    token: rawToken,
    expiresAt: expiresAt.toISOString(),
  }
})
