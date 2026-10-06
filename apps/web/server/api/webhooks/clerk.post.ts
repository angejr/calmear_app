import { verifyWebhook } from '@clerk/nuxt/webhooks'
import type { WebhookEvent } from '@clerk/nuxt/webhooks'
import { deleteAccountForClerkUser } from '../../services/account-deletion'

/**
 * POST /api/webhooks/clerk
 *
 * Receives Clerk webhook events (signed with Svix). The signature is verified
 * with NUXT_CLERK_WEBHOOK_SIGNING_SECRET.
 *
 *  - user.deleted: the user deleted their account (Clerk's "Delete account"
 *    in the profile, or an admin in the Clerk dashboard). Their CalmEar
 *    account is deleted too: Stripe subscriptions cancelled, database records
 *    removed (see services/account-deletion.ts).
 *
 * Processing errors return 500 so Clerk retries the delivery; deletion is
 * idempotent, so a retry after a partial failure is safe.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (!(config.clerk as { webhookSigningSecret?: string } | undefined)?.webhookSigningSecret) {
    throw createError({ statusCode: 500, statusMessage: 'Clerk webhook secret not configured.' })
  }

  let clerkEvent: WebhookEvent
  try {
    clerkEvent = await verifyWebhook(event)
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'Webhook signature verification failed.' })
  }

  if (clerkEvent.type === 'user.deleted' && clerkEvent.data.id) {
    try {
      const result = await deleteAccountForClerkUser(clerkEvent.data.id)
      console.warn('[clerk-webhook] user.deleted', clerkEvent.data.id, result)
    }
    catch (err) {
      console.error('[clerk-webhook] Failed to delete account', clerkEvent.data.id, err)
      throw createError({ statusCode: 500, statusMessage: 'Account deletion failed.' })
    }
  }

  return { received: true }
})
