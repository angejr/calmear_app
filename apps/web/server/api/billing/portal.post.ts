import { requireClerkAuth } from '../../utils/auth'
import { getUserByClerkId } from '../../services/users'
import { useStripe } from '../../services/stripe'

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for the authenticated user.
 * Returns the portal URL — the client redirects there.
 *
 * Authentication: Clerk session (website cookie)
 */
export default defineEventHandler(async (event) => {
  const clerkUserId = await requireClerkAuth(event)

  const user = await getUserByClerkId(clerkUserId)
  if (!user?.stripeCustomerId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No billing account found. Please subscribe first.',
    })
  }

  const stripe = useStripe()
  const config = useRuntimeConfig()
  const appUrl = config.public.appUrl

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl}/dashboard`,
  })

  return { url: portalSession.url }
})
