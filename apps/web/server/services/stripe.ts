import Stripe from 'stripe'
import { createError } from 'h3'

let _stripe: Stripe | null = null

/**
 * Returns a singleton Stripe SDK instance.
 * NUXT_STRIPE_SECRET_KEY is a server-only runtime config value — never exposed client-side.
 */
export function useStripe(): Stripe {
  if (_stripe) return _stripe

  const config = useRuntimeConfig()
  const key = config.stripeSecretKey?.trim()

  if (!key) {
    throw new Error('NUXT_STRIPE_SECRET_KEY is not set.')
  }

  _stripe = new Stripe(key, {
    apiVersion: '2025-06-30.basil',
    typescript: true,
  })

  return _stripe
}

/**
 * Maps our internal plan keys to Stripe Price IDs from environment variables.
 * The client NEVER sends a Stripe Price ID — only a plan key.
 */
export function getPriceId(plan: 'monthly' | 'yearly'): string {
  const config = useRuntimeConfig()

  const priceId =
    plan === 'monthly'
      ? config.stripeMonthlyPriceId
      : config.stripeYearlyPriceId

  if (!priceId) {
    throw createError({
      statusCode: 500,
      statusMessage: `Stripe Price ID for plan "${plan}" is not configured.`,
    })
  }

  return priceId
}

/**
 * Finds or creates a Stripe Customer for the given user.
 * Associates the customer with the CalmEar user ID and Clerk user ID via metadata.
 */
export async function findOrCreateStripeCustomer(options: {
  email?: string | null
  calmearUserId: string
  clerkUserId: string
  existingStripeCustomerId?: string | null
}): Promise<string> {
  const stripe = useStripe()

  if (options.existingStripeCustomerId) {
    return options.existingStripeCustomerId
  }

  const customer = await stripe.customers.create({
    email: options.email ?? undefined,
    metadata: {
      calmearUserId: options.calmearUserId,
      clerkUserId: options.clerkUserId,
    },
  })

  return customer.id
}
