import { getRequestHeader, readRawBody } from 'h3'
import Stripe from 'stripe'
import { useStripe } from '../../services/stripe'
import { updateUserStripeByCustomerId, getUserByClerkId, updateUserStripe } from '../../services/users'
import type { User } from '../../../drizzle/schema'

/**
 * POST /api/webhooks/stripe
 *
 * Receives and processes Stripe webhook events.
 * Signature is verified using STRIPE_WEBHOOK_SECRET — unsigned events are rejected.
 *
 * This route is the authoritative source for subscription state.
 * The frontend success redirect is informational only.
 *
 * Processing is idempotent: re-delivery of the same event produces the same state.
 */
export default defineEventHandler(async (event) => {
  // Stripe requires the raw body for signature verification
  const rawBody = await readRawBody(event)
  const sig = getRequestHeader(event, 'stripe-signature')

  if (!rawBody || !sig) {
    throw createError({ statusCode: 400, statusMessage: 'Missing body or Stripe signature.' })
  }

  const config = useRuntimeConfig()
  const webhookSecret = config.stripeWebhookSecret

  if (!webhookSecret) {
    throw createError({ statusCode: 500, statusMessage: 'Stripe webhook secret not configured.' })
  }

  const stripe = useStripe()
  let stripeEvent: Stripe.Event

  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    throw createError({
      statusCode: 400,
      statusMessage: `Webhook signature verification failed: ${(err as Error).message}`,
    })
  }

  // Process the event
  try {
    await handleStripeEvent(stripeEvent)
  } catch (err) {
    // Log but don't throw — return 200 to prevent Stripe from retrying
    // for application-level errors (user not found, etc.)
    console.error(`[stripe-webhook] Error processing event ${stripeEvent.id}:`, err)
  }

  return { received: true }
})

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      await handleCheckoutCompleted(session)
      break
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      await handleSubscriptionUpsert(sub)
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await handleSubscriptionDeleted(sub)
      break
    }
    case 'invoice.paid': {
      // Subscription period renewed — subscription.updated handles the state
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await handlePaymentFailed(invoice)
      break
    }
    default:
      // Silently ignore unknown events
      break
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const clerkUserId = session.metadata?.clerkUserId
  if (!clerkUserId) return

  // If there's a subscription, subscription.created will fire next and handle state.
  // Here we just ensure the customer ID is linked if not already.
  if (session.customer && typeof session.customer === 'string') {
    await updateUserStripe(clerkUserId, { stripeCustomerId: session.customer })
  }
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

  const status = mapStripeStatus(sub.status)
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : null

  await updateUserStripeByCustomerId(customerId, {
    stripeSubscriptionId: sub.id,
    subscriptionStatus: status,
    subscriptionCurrentPeriodEnd: periodEnd,
  })
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

  await updateUserStripeByCustomerId(customerId, {
    stripeSubscriptionId: null,
    subscriptionStatus: 'canceled',
    subscriptionCurrentPeriodEnd: sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null,
  })
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id

  if (!customerId) return

  await updateUserStripeByCustomerId(customerId, {
    subscriptionStatus: 'past_due',
  })
}

/**
 * Maps Stripe subscription statuses to our validated enum set.
 */
function mapStripeStatus(status: Stripe.Subscription.Status): User['subscriptionStatus'] {
  const map: Record<Stripe.Subscription.Status, User['subscriptionStatus']> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    paused: 'canceled',
  }
  return map[status] ?? 'none'
}
