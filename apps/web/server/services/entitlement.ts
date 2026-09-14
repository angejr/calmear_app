import type { User } from '../../drizzle/schema'

/**
 * The three application-level access tiers.
 *
 * - trial   : within the 30-day free trial window
 * - premium : active paid Stripe subscription
 * - free    : trial expired, no active subscription
 *
 * "free" is intentionally kept as an enum value so a future limited free tier
 * can be introduced without changing this type or the entitlement endpoint shape.
 */
export type CalmEarPlan = 'trial' | 'premium' | 'free'

export interface CalmEarEntitlement {
  authenticated: boolean
  active: boolean
  plan: CalmEarPlan
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
}

/**
 * Statuses that indicate an active, paid Stripe subscription.
 */
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing'])

/**
 * Computes the entitlement for a given CalmEar application user.
 *
 * This is the single source of truth for access decisions.
 * Both the dashboard and /api/extension/entitlement use this function.
 *
 * Priority:
 *   1. Valid paid subscription → premium
 *   2. Within trial window    → trial
 *   3. Otherwise              → free (no access)
 */
export function computeEntitlement(user: User): CalmEarEntitlement {
  const now = new Date()

  const trialEndsAt = user.trialEndsAt ?? null
  const subscriptionEndsAt = user.subscriptionCurrentPeriodEnd ?? null

  // Premium: active Stripe subscription.
  // Stripe's subscriptionStatus is authoritative. We do NOT gate on
  // subscriptionCurrentPeriodEnd because in the Stripe Basil API the top-level
  // current_period_end moved to sub.items.data[0].current_period_end and may be
  // null in the DB. subscriptionEndsAt is used for display only.
  const hasPremium = ACTIVE_SUBSCRIPTION_STATUSES.has(user.subscriptionStatus)

  if (hasPremium) {
    return {
      authenticated: true,
      active: true,
      plan: 'premium',
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      subscriptionEndsAt: subscriptionEndsAt?.toISOString() ?? null,
    }
  }

  // Trial: within the 30-day application trial window
  const inTrial = trialEndsAt !== null && trialEndsAt > now

  if (inTrial) {
    return {
      authenticated: true,
      active: true,
      plan: 'trial',
      trialEndsAt: trialEndsAt!.toISOString(),
      subscriptionEndsAt: null,
    }
  }

  // Free/expired
  return {
    authenticated: true,
    active: false,
    plan: 'free',
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    subscriptionEndsAt: null,
  }
}
