import { requireClerkAuth } from '../../utils/auth'
import { ensureUser, updateUserStripe } from '../../services/users'
import { findOrCreateStripeCustomer, getPriceId, useStripe } from '../../services/stripe'
import { computeEntitlement } from '../../services/entitlement'

const ALLOWED_PLANS = ['monthly', 'yearly'] as const

export default defineEventHandler(async (event) => {
  const clerkUserId = await requireClerkAuth(event)

  const body = await readBody(event)
  const plan = body?.plan

  if (!ALLOWED_PLANS.includes(plan)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid plan. Must be monthly or yearly.' })
  }

  const user = await ensureUser(clerkUserId)

  // Block duplicate checkout: if already Premium, redirect to portal instead
  const currentEntitlement = computeEntitlement(user)
  if (currentEntitlement.plan === 'premium') {
    throw createError({
      statusCode: 409,
      statusMessage: 'You already have an active Premium subscription. Use the billing portal to manage it.',
    })
  }

  const stripe = useStripe()
  const priceId = getPriceId(plan)
  const config = useRuntimeConfig()
  const appUrl = config.public.appUrl

  const stripeCustomerId = await findOrCreateStripeCustomer({
    email: user.email,
    calmearUserId: user.id,
    clerkUserId,
    existingStripeCustomerId: user.stripeCustomerId,
  })

  if (!user.stripeCustomerId) {
    await updateUserStripe(clerkUserId, { stripeCustomerId })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
    metadata: { calmearUserId: user.id, clerkUserId },
    subscription_data: { metadata: { calmearUserId: user.id, clerkUserId } },
    allow_promotion_codes: true,
  })

  if (!session.url) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create checkout session.' })
  }

  return { url: session.url }
})
