import { getRequestHeader } from 'h3'
import { extractBearerToken, revokeExtensionToken } from '../../services/extension-auth'

/**
 * DELETE /api/extension/session
 *
 * Revokes the extension session associated with the provided Bearer token.
 * The extension should call this on user-initiated logout.
 *
 * Authentication: Bearer token (extension token)
 */
export default defineEventHandler(async (event) => {
  const authHeader = getRequestHeader(event, 'authorization')
  const token = extractBearerToken(authHeader)

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authorization header with Bearer token required.',
    })
  }

  await revokeExtensionToken(token)

  return { success: true, message: 'Extension session revoked.' }
})
