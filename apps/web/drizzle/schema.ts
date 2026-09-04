import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'none',
  'active',
  'trialing',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
])

// ---------------------------------------------------------------------------
// users
// Stores CalmEar application state per authenticated Clerk user.
// Clerk is authoritative for identity; this table owns trial + billing state.
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),

  /** Clerk user ID — the stable cross-session identity */
  clerkUserId: text('clerk_user_id').notNull().unique(),

  /** Copied from Clerk for convenience; not authoritative for auth */
  email: text('email'),

  // Trial state — set once on first record creation; never reset
  trialStartedAt: timestamp('trial_started_at', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),

  // Stripe billing state — updated via webhooks only
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  subscriptionStatus: subscriptionStatusEnum('subscription_status')
    .notNull()
    .default('none'),
  subscriptionCurrentPeriodEnd: timestamp('subscription_current_period_end', {
    withTimezone: true,
  }),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// ---------------------------------------------------------------------------
// extension_pairing_codes
// Short-lived, one-time codes shown in the dashboard.
// The Chrome extension submits the raw code to /api/extension/activate.
// We store only the SHA-256 hash — never the raw code.
// ---------------------------------------------------------------------------

export const extensionPairingCodes = pgTable('extension_pairing_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** SHA-256(raw_code) — never store the raw code */
  codeHash: text('code_hash').notNull().unique(),

  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// ---------------------------------------------------------------------------
// extension_sessions
// Long-lived sessions issued after a pairing code is consumed.
// The extension stores the raw bearer token; we store only SHA-256(token).
// ---------------------------------------------------------------------------

export const extensionSessions = pgTable('extension_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** SHA-256(raw_bearer_token) */
  tokenHash: text('token_hash').notNull().unique(),

  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type ExtensionPairingCode = typeof extensionPairingCodes.$inferSelect
export type ExtensionSession = typeof extensionSessions.$inferSelect
