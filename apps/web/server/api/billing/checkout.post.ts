import { requireClerkAuth } from '../../utils/auth'
import { ensureUser, updateUserStripe } from '../../services/users'
import { findOrCreateStripeCustomer, getPriceId, useStripe } from '../../services/stripe'
import type { PlanKey } from '../../../config/pricing'

const ALLOWED_PLANS: PlanKey[] = ['monthly', 'yearly']

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for the authenticated user.
 * The client sends only a plan key ("monthly" | "yearly") — never a Stripe Price ID.
 * Server maps the plan key to the configured Price ID.
 *
 * Authentication: Clerk session (website cookie)
 */
export default defineEventHandler(async (event) => {
  const clerkUserId = await requireClerkAuth(event)

  const body = await readBody(event)
  const plan = body?.plan as string

  if (!ALLOWED_PLANS.includes(plan as PlanKey)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid plan. Must be one of: ${ALLOWED_PLANS.join(', ')}`,
    })
  }

  const user = await ensureUser(clerkUserId)
  const stripe = useStripe()
  const priceId = getPriceId(plan as PlanKey)
  const config = useRuntimeConfig()
  const appUrl = config.public.appUrl

  // Find or create a Stripe Customer for this user
  const stripeCustomerId = await findOrCreateStripeCustomer({
    email: user.email,
    calmearUserId: user.id,
    clerkUserId,
    existingStripeCustomerId: user.stripeCustomerId,
  })

  // Persist the customer ID if it's new
  if (!user.stripeCustomerId) {
    await updateUserStripe(clerkUserId, { stripeCustomerId })
  }

  // Create Stripe Checkout session
  // NOTE: We do NOT use Stripe's trial_period_days here because CalmEar's trial
  // is application-managed and does NOT require a credit card.
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    metadata: {
      calmearUserId: user.id,
      clerkUserId,
    },
    subscription_data: {
      metadata: {
        calmearUserId: user.id,
        clerkUserId,
      },
    },
    allow_promotion_codes: true,
  })

  if (!session.url) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create checkout session.' })
  }

  return { url: session.url }
})
