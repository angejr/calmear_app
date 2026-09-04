import { requireClerkAuth } from '../../utils/auth'
import { ensureUser } from '../../services/users'
import { createPairingCode } from '../../services/extension-auth'

/**
 * POST /api/extension/pairing-code
 *
 * Generates a one-time pairing code for the authenticated web user.
 * The code is displayed in the dashboard; the user enters it in the extension.
 *
 * Authentication: Clerk session (website cookie)
 */
export default defineEventHandler(async (event) => {
  const clerkUserId = await requireClerkAuth(event)
  const user = await ensureUser(clerkUserId)

  const { rawCode, expiresAt } = await createPairingCode(user.id)

  return {
    code: rawCode,
    expiresAt: expiresAt.toISOString(),
  }
})
