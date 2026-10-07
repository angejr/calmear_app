import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { useDb } from '../utils/db'
import { hashEmail } from '../utils/crypto'
import { useStripe } from './stripe'
import { getUserByClerkId } from './users'
import { deletedAccounts, users } from '../../drizzle/schema'
import type { User } from '../../drizzle/schema'

/** Database and Stripe clients (passed in so scripts can reuse the deletion outside Nuxt). */
export interface AccountDeletionDeps {
  db: ReturnType<typeof useDb>
  stripe: Stripe
}

/** Stripe subscription statuses that can still charge the customer. */
const CANCELLABLE_STATUSES = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
  'paused',
])

/** IDs of the subscriptions that must be cancelled before the account is deleted. */
export function subscriptionsToCancel(subs: Pick<Stripe.Subscription, 'id' | 'status'>[]): string[] {
  return subs.filter(s => CANCELLABLE_STATUSES.has(s.status)).map(s => s.id)
}

/**
 * Cancels, immediately and without refund, every subscription of the customer
 * that could still charge them. The Stripe customer and its invoices are kept
 * (accounting records).
 */
async function cancelCustomerSubscriptions(stripe: Stripe, stripeCustomerId: string): Promise<void> {
  let subs: Stripe.Subscription[]
  try {
    subs = (await stripe.subscriptions.list({ customer: stripeCustomerId, status: 'all', limit: 100 })).data
  }
  catch (err) {
    // Customer already deleted in Stripe: nothing left to cancel.
    if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === 'resource_missing') return
    throw err
  }
  for (const id of subscriptionsToCancel(subs)) {
    await stripe.subscriptions.cancel(id)
  }
}

/**
 * Deletes a CalmEar account:
 *   1. cancels the user's Stripe subscriptions, so they are never charged again;
 *   2. records a one-way hash of their email (no new trial for that email);
 *   3. deletes the users row; extension codes and sessions go with it (cascade).
 *
 * If the Stripe step fails, nothing is deleted and the error is thrown.
 */
export async function deleteAccount({ db, stripe }: AccountDeletionDeps, user: User): Promise<void> {
  if (user.stripeCustomerId) await cancelCustomerSubscriptions(stripe, user.stripeCustomerId)

  await db.transaction(async (tx) => {
    if (user.email) {
      await tx
        .insert(deletedAccounts)
        .values({ emailHash: hashEmail(user.email), version: user.version })
        .onConflictDoNothing()
    }
    await tx.delete(users).where(eq(users.id, user.id))
  })
}

/**
 * Deletes the CalmEar account of a Clerk user after their Clerk account was
 * deleted (Clerk `user.deleted` webhook). Idempotent: an unknown or already
 * deleted user returns 'not_found'.
 */
export async function deleteAccountForClerkUser(clerkUserId: string): Promise<'deleted' | 'not_found'> {
  const user = await getUserByClerkId(clerkUserId)
  if (!user) return 'not_found'
  await deleteAccount({ db: useDb(), stripe: useStripe() }, user)
  return 'deleted'
}
