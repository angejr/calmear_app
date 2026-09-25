import { getAuth, clerkClient } from '@clerk/nuxt/server'
import { requireClerkAuth } from '../../utils/auth'
import { ensureUser } from '../../services/users'
import { computeEntitlement } from '../../services/entitlement'

/**
 * GET /api/user/me
 *
 * Returns the current authenticated user's CalmEar application data
 * and computed entitlement. Creates the CalmEar user on first call
 * (idempotent — safe to call multiple times).
 *
 * Authentication: Clerk session (website cookie)
 */
export default defineEventHandler(async (event) => {
  const clerkUserId = await requireClerkAuth(event)

  // Fetch email from Clerk to store on first creation
  let email: string | null = null
  try {
    const clerk = await clerkClient(event)
    const clerkUser = await clerk.users.getUser(clerkUserId)
    email = clerkUser.emailAddresses[0]?.emailAddress ?? null
  } catch {
    // Non-fatal — email is optional in our schema
  }

  const user = await ensureUser(clerkUserId, email)
  const entitlement = computeEntitlement(user)

  return {
    user: {
      id: user.id,
      email: user.email,
      version: user.version,
      trialStartedAt: user.trialStartedAt?.toISOString() ?? null,
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      stripeCustomerId: user.stripeCustomerId ?? null,
      subscriptionStatus: user.subscriptionStatus,
      createdAt: user.createdAt.toISOString(),
    },
    entitlement,
  }
})
