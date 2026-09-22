import { requireClerkAuth } from '../../utils/auth'
import { ensureUser } from '../../services/users'
import { createAuthCode } from '../../services/extension-auth'

/**
 * POST /api/extension/authorize
 *
 * Creates a short-lived, single-use authorization code for the authenticated
 * web user. The browser (extension authorize page) receives the code and
 * redirects it to the extension's callback page, where the extension exchanges
 * it for a long-lived bearer token via POST /api/extension/token.
 *
 * Authentication: Clerk session (website cookie)
 */
export default defineEventHandler(async (event) => {
  const clerkUserId = await requireClerkAuth(event)
  const user = await ensureUser(clerkUserId)

  const body = await readBody(event)
  const redirectUri = body?.redirectUri as string | undefined

  // Defend against open redirects: the extension callback URI must be a
  // chrome-extension:// URL pointing at the web-accessible callback page.
  if (!redirectUri || !redirectUri.startsWith('chrome-extension://') || !redirectUri.endsWith('/auth/callback.html')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid redirect URI.' })
  }

  const { rawCode, expiresAt } = await createAuthCode(user.id)

  return {
    code: rawCode,
    expiresAt: expiresAt.toISOString(),
  }
})
