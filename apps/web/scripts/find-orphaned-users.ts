/**
 * Lists CalmEar users whose Clerk account no longer exists (deleted in Clerk
 * before the user.deleted webhook was in place) and, with --delete, deletes
 * them exactly as the webhook would (services/account-deletion.ts): Stripe
 * subscriptions cancelled, email hash kept, users row deleted.
 *
 *   npx tsx --env-file=.env scripts/find-orphaned-users.ts            # list only
 *   npx tsx --env-file=.env scripts/find-orphaned-users.ts --delete   # list, then delete
 *   (--show-emails prints full emails instead of masked ones)
 *
 * Uses NUXT_DATABASE_URL, NUXT_CLERK_SECRET_KEY and, for --delete,
 * NUXT_STRIPE_SECRET_KEY. The database is shared by both Clerk instances
 * (users.version), so only the rows of the instance the Clerk key belongs to
 * are handled: sk_test_ -> 'development' rows, sk_live_ -> 'production' rows.
 * For production rows, pass the live keys in the shell (they take precedence
 * over .env):
 *
 *   NUXT_CLERK_SECRET_KEY=sk_live_... NUXT_STRIPE_SECRET_KEY=sk_live_... \
 *     npx tsx --env-file=.env scripts/find-orphaned-users.ts --delete
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import Stripe from 'stripe'
import * as schema from '../drizzle/schema'
import type { User } from '../drizzle/schema'
import { deleteAccount } from '../server/services/account-deletion'

const CLERK_API = 'https://api.clerk.com/v1'
const BATCH = 100

function maskEmail(email: string | null): string {
  if (!email) return '(no email)'
  const [local = '', domain = ''] = email.split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

/** IDs among `ids` that still exist in Clerk (List users, filtered by user_id). */
async function existingClerkIds(secretKey: string, ids: string[]): Promise<Set<string>> {
  const existing = new Set<string>()
  for (let i = 0; i < ids.length; i += BATCH) {
    const params = new URLSearchParams({ limit: String(BATCH) })
    for (const id of ids.slice(i, i + BATCH)) params.append('user_id', id)
    const res = await fetch(`${CLERK_API}/users?${params}`, { headers: { Authorization: `Bearer ${secretKey}` } })
    if (!res.ok) {
      // Never conclude that users are gone when Clerk could not be asked.
      throw new Error(`Clerk API returned ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }
    for (const u of await res.json() as Array<{ id: string }>) existing.add(u.id)
  }
  return existing
}

async function main() {
  const dbUrl = process.env.NUXT_DATABASE_URL
  const clerkKey = process.env.NUXT_CLERK_SECRET_KEY
  if (!dbUrl || !clerkKey) throw new Error('NUXT_DATABASE_URL and NUXT_CLERK_SECRET_KEY are required.')
  const doDelete = process.argv.includes('--delete')
  const showEmails = process.argv.includes('--show-emails')
  const instance: User['version'] = clerkKey.startsWith('sk_live_') ? 'production' : 'development'

  const client = postgres(dbUrl, { max: 1, prepare: false })
  const db = drizzle(client, { schema })
  try {
    const rows = await db.select().from(schema.users).orderBy(schema.users.createdAt)
    const toCheck = rows.filter(r => r.version === instance)
    const existing = await existingClerkIds(clerkKey, toCheck.map(r => r.clerkUserId))
    const orphaned = toCheck.filter(r => !existing.has(r.clerkUserId))

    console.warn(`Clerk instance checked: ${instance}`)
    console.warn(`Users in database: ${rows.length} (${toCheck.length} ${instance}, ${rows.length - toCheck.length} other instance, not checked)`)
    console.warn(`Still in Clerk: ${toCheck.length - orphaned.length}. Missing from Clerk (to clean): ${orphaned.length}\n`)
    if (orphaned.length === 0) return
    // eslint-disable-next-line no-console -- table output for the operator
    console.table(orphaned.map(r => ({
      created: r.createdAt.toISOString().slice(0, 10),
      email: showEmails ? (r.email ?? '(no email)') : maskEmail(r.email),
      clerk_user_id: r.clerkUserId,
      subscription: r.subscriptionStatus,
      stripe_customer: r.stripeCustomerId ? 'yes' : 'no',
      user_id: r.id,
    })))

    if (!doDelete) {
      console.warn('\nList only. Re-run with --delete to delete these accounts.')
      return
    }

    // A test-mode Stripe key cannot see live customers: it would report "no such
    // customer" and the account would be deleted with its live subscription
    // still charging. Require the Stripe mode that matches the Clerk instance.
    const stripeKey = process.env.NUXT_STRIPE_SECRET_KEY?.trim()
    const expectedPrefix = instance === 'production' ? 'sk_live_' : 'sk_test_'
    if (orphaned.some(r => r.stripeCustomerId) && !stripeKey?.startsWith(expectedPrefix)) {
      throw new Error(`Refusing to delete: ${instance} accounts with a Stripe customer need a ${expectedPrefix} NUXT_STRIPE_SECRET_KEY.`)
    }
    // Same API version as server/services/stripe.ts (newer than the installed SDK's type definitions).
    const apiVersion = '2025-06-30.basil' as Stripe.StripeConfig['apiVersion']
    const stripe = new Stripe(stripeKey || 'sk_test_unused', { apiVersion, typescript: true })

    let deleted = 0
    for (const user of orphaned) {
      try {
        await deleteAccount({ db, stripe }, user)
        deleted++
        console.warn(`Deleted ${user.clerkUserId}`)
      }
      catch (err) {
        console.error(`Failed to delete ${user.clerkUserId} (nothing deleted for this user):`, err instanceof Error ? err.message : err)
      }
    }
    console.warn(`\nDeleted ${deleted} of ${orphaned.length} account(s).`)
  }
  finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
