import { getRequestHeader } from 'h3'
import { resolveExtensionToken, extractBearerToken } from '../../services/extension-auth'
import { computeEntitlement } from '../../services/entitlement'

/**
 * GET /api/extension/entitlement
 *
 * The primary API endpoint for the Chrome extension.
 * Returns whether the user has active access and which plan they're on.
 *
 * Authentication: Bearer token (issued via /api/extension/activate)
 *
 * This endpoint's response shape is the stable contract with the extension.
 * Do not change it without updating the extension and EXTENSION_INTEGRATION.md.
 *
 * Example integration:
 *   const res = await fetch('https://calmear.com/api/extension/entitlement', {
 *     headers: { Authorization: `Bearer ${storedToken}` }
 *   })
 *   const { active } = await res.json()
 *   if (active) runCalmEarAudioPipeline()
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

  const user = await resolveExtensionToken(token)
  const entitlement = computeEntitlement(user)

  // Return only the extension-facing fields (not internal user data)
  return {
    active: entitlement.active,
    plan: entitlement.plan,
    trialEndsAt: entitlement.trialEndsAt,
    subscriptionEndsAt: entitlement.subscriptionEndsAt,
  }
})
