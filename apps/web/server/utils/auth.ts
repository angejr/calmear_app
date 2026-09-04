import { getAuth } from '@clerk/nuxt/server'
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
