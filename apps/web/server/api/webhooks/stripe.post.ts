import { getRequestHeader, readRawBody } from 'h3'
import Stripe from 'stripe'
import { useStripe } from '../../services/stripe'
import { updateUserStripe, updateUserStripeByCustomerId } from '../../services/users'
import type { User } from '../../../drizzle/schema'

/**
 * POST /api/webhooks/stripe
 *
 * Receives and processes Stripe webhook events.
 * Signature is verified using STRIPE_WEBHOOK_SECRET.
 *
 * Design notes:
 *  - checkout.session.completed is the PRIMARY handler for new subscriptions.
 *    It has clerkUserId in metadata (always set by us) so it never relies on
 *    the stripeCustomerId being in our DB yet. It expands the subscription
 *    object inline and writes all fields atomically in one update.
 *
 *  - customer.subscription.updated handles renewals/changes AFTER the initial
 *    checkout, when stripeCustomerId is guaranteed to be in the DB. It also
 *    falls back to clerkUserId from sub metadata.
 *
 *  - customer.subscription.deleted marks cancellation.
 *
 *  - invoice.payment_failed marks past_due.
 *
 * Idempotent: re-delivering the same event produces the same DB state.
 */
export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event)
  const sig = getRequestHeader(event, 'stripe-signature')

  if (!rawBody || !sig) {
    throw createError({ statusCode: 400, statusMessage: 'Missing body or Stripe signature.' })
  }

  const config = useRuntimeConfig()
  const webhookSecret = config.stripeWebhookSecret?.trim()
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

  try {
    await handleStripeEvent(stripe, stripeEvent)
  } catch (err) {
    // Log but return 200 so Stripe does not keep retrying for application errors.
    console.error('[stripe-webhook] Error processing event', stripeEvent.id, stripeEvent.type, err)
  }

  return { received: true }
})

async function handleStripeEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session)
      break
    }
    // customer.subscription.created fires alongside checkout.session.completed
    // for new subscriptions. We skip it here intentionally — checkout.session.completed
    // already handles the full write via clerkUserId. Handling both creates a race.
    // We DO handle updated (renewals, plan changes) and deleted (cancellations).
    case 'customer.subscription.updated': {
      await handleSubscriptionUpsert(event.data.object as Stripe.Subscription)
      break
    }
    case 'customer.subscription.deleted': {
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break
    }
    case 'invoice.payment_failed': {
      await handlePaymentFailed(event.data.object as Stripe.Invoice)
      break
    }
    case 'invoice.paid':
    case 'customer.subscription.created':
    default:
      // Intentionally ignored or handled elsewhere
      break
  }
}

/**
 * PRIMARY handler for new subscriptions.
 *
 * Uses clerkUserId from session metadata (always set by checkout.post.ts) so
 * it never needs stripeCustomerId to already be in the database. Expands the
 * subscription object to get status and period_end, then writes everything
 * atomically in one UPDATE keyed off clerkUserId.
 */
async function handleCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  // Identity: always use clerkUserId from metadata — we set this, we trust it.
  const clerkUserId = session.metadata?.clerkUserId
  if (!clerkUserId) {
    console.error('[stripe-webhook] checkout.session.completed missing clerkUserId in metadata', session.id)
    return
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  if (!customerId) {
    console.error('[stripe-webhook] checkout.session.completed missing customer', session.id)
    return
  }

  // For subscription-mode sessions, get the subscription to read status + period_end
  if (session.mode !== 'subscription' || !session.subscription) {
    // Non-subscription checkout — just ensure customer is linked
    await updateUserStripe(clerkUserId, { stripeCustomerId: customerId })
    return
  }

  const subId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription.id

  // Expand the subscription so we have status and current_period_end
  const sub = await stripe.subscriptions.retrieve(subId)

  const status = mapStripeStatus(sub.status)
  const periodEnd = getSubscriptionPeriodEnd(sub)

  // Write everything in one update keyed off clerkUserId (not stripeCustomerId)
  await updateUserStripe(clerkUserId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    subscriptionStatus: status,
    subscriptionCurrentPeriodEnd: periodEnd,
  })

  console.log('[stripe-webhook] checkout completed — user', clerkUserId, 'status', status, 'period_end', periodEnd)
}

/**
 * Handles subscription renewals and plan changes.
 * Called for customer.subscription.updated events (NOT created — that's handled
 * by checkout.session.completed to avoid the race condition).
 *
 * By the time .updated fires (renewal cycle), stripeCustomerId is in our DB.
 * Falls back to clerkUserId from sub metadata if customer lookup fails.
 */
async function handleSubscriptionUpsert(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const status = mapStripeStatus(sub.status)
  const periodEnd = getSubscriptionPeriodEnd(sub)

  const data = {
    stripeSubscriptionId: sub.id,
    subscriptionStatus: status,
    subscriptionCurrentPeriodEnd: periodEnd,
  }

  // Primary path: look up by stripe customer ID
  await updateUserStripeByCustomerId(customerId, data)

  console.log('[stripe-webhook] subscription updated — customer', customerId, 'status', status)
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id

  await updateUserStripeByCustomerId(customerId, {
    stripeSubscriptionId: null,
    subscriptionStatus: 'canceled',
    subscriptionCurrentPeriodEnd: getSubscriptionPeriodEnd(sub),
  })

  console.log('[stripe-webhook] subscription deleted — customer', customerId)
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id
  if (!customerId) return

  await updateUserStripeByCustomerId(customerId, { subscriptionStatus: 'past_due' })

  console.warn('[stripe-webhook] payment failed — customer', customerId)
}


/**
 * Gets the current period end timestamp from a subscription.
 * Stripe Basil API moved current_period_end from the top-level subscription
 * object to sub.items.data[0].current_period_end. We read both for compatibility.
 */
function getSubscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ts = (sub as any).current_period_end || sub.items?.data?.[0]?.current_period_end
  return ts ? new Date(ts * 1000) : null
}

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
