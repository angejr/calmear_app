import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { useDb } from '../utils/db'
import { getAppVersion } from '../utils/version'
import { users } from '../../drizzle/schema'
import type { User } from '../../drizzle/schema'

const TRIAL_DURATION_DAYS = 30

/**
 * Idempotently ensures a CalmEar application user exists for the given
 * Clerk user. If one already exists it is returned unchanged.
 *
 * On first creation:
 *   - version = current environment ('production' or 'development',
 *     derived from the configured Clerk publishable key)
 *   - trial_started_at = NOW()
 *   - trial_ends_at = NOW() + 30 days
 *
 * The trial clock starts on the date the CalmEar account is created.
 * It is NOT reset by logout, reinstall, or cache clears.
 * The database is authoritative.
 *
 * The (version, email) unique index guarantees one account per email per
 * environment: if a DIFFERENT Clerk account already owns this email in this
 * version, a 409 is thrown instead of silently creating a duplicate row.
 */
export async function ensureUser(clerkUserId: string, email?: string | null): Promise<User> {
  const db = useDb()
  const version = getAppVersion()

  // Try to find existing user first
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1)

  if (existing.length > 0) {
    return existing[0]!
  }

  // Create new user with trial
  const now = new Date()
  const trialEndsAt = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000)

  const [created] = await db
    .insert(users)
    .values({
      clerkUserId,
      email: email ?? null,
      version,
      trialStartedAt: now,
      trialEndsAt,
      subscriptionStatus: 'none',
    })
    .onConflictDoNothing()
    .returning()

  // Handle rare race condition: another request inserted first
  if (!created) {
    const [raceWinner] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1)

    if (raceWinner) return raceWinner

    // Not a race on clerk_user_id — the (version, email) unique index
    // rejected the insert: another Clerk account already owns this email
    // in this environment.
    throw createError({
      statusCode: 409,
      statusMessage: 'An account with this email already exists in this environment.',
    })
  }

  return created
}

/**
 * Fetch an existing user by their CalmEar database ID.
 */
export async function getUserById(id: string): Promise<User | null> {
  const db = useDb()
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  return user ?? null
}

/**
 * Fetch an existing user by Clerk user ID.
 */
export async function getUserByClerkId(clerkUserId: string): Promise<User | null> {
  const db = useDb()
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1)
  return user ?? null
}

/**
 * Update Stripe billing fields on a user record.
 * Called from Stripe webhook handlers.
 */
export async function updateUserStripe(
  clerkUserId: string,
  data: {
    stripeCustomerId?: string
    stripeSubscriptionId?: string | null
    subscriptionStatus?: User['subscriptionStatus']
    subscriptionCurrentPeriodEnd?: Date | null
  },
): Promise<void> {
  const db = useDb()
  await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.clerkUserId, clerkUserId))
}

/**
 * Update Stripe billing fields on a user record by their Stripe customer ID.
 * Called from Stripe webhook handlers where we may not have Clerk user ID
 * directly but do have the Stripe customer ID.
 */
export async function updateUserStripeByCustomerId(
  stripeCustomerId: string,
  data: {
    stripeSubscriptionId?: string | null
    subscriptionStatus?: User['subscriptionStatus']
    subscriptionCurrentPeriodEnd?: Date | null
  },
): Promise<void> {
  const db = useDb()
  await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.stripeCustomerId, stripeCustomerId))
}
