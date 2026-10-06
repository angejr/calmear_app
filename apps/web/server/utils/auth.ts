import { clerkClient, getAuth } from '@clerk/nuxt/server'
import { createError } from 'h3'
import type { H3Event } from 'h3'

/**
 * Requires a valid Clerk session on the given Nitro event.
 * Throws a 401 if the user is not authenticated.
 *
 * Returns the Clerk userId — never trust a userId from the request body.
 */
export async function requireClerkAuth(event: H3Event): Promise<string> {
  const { userId } = getAuth(event)

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required.',
    })
  }

  return userId
}

/**
 * The user's email address from Clerk, or null if it cannot be fetched.
 * Non-fatal: email is optional in our schema.
 */
export async function getClerkUserEmail(event: H3Event, clerkUserId: string): Promise<string | null> {
  try {
    const clerk = await clerkClient(event)
    const clerkUser = await clerk.users.getUser(clerkUserId)
    return clerkUser.emailAddresses[0]?.emailAddress ?? null
  }
  catch {
    return null
  }
}
