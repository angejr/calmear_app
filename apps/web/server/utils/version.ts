/**
 * server/utils/version.ts
 *
 * Determines which environment ("version") the app is running in, derived
 * from the configured Clerk instance:
 *   pk_live_...  -> 'production'  (Clerk Production instance)
 *   pk_test_...  -> 'development' (Clerk Development instance)
 *
 * This is stamped on every new user row so development and production
 * users stay distinguishable in a shared database — with no extra
 * configuration: it always reflects the Clerk instance actually in use.
 */

export type AppVersion = 'production' | 'development'

/**
 * Pure derivation from a Clerk publishable key (exposed for unit tests).
 */
export function deriveVersionFromClerkKey(
  publishableKey: string | null | undefined,
): AppVersion {
  return publishableKey?.startsWith('pk_live_') ? 'production' : 'development'
}

/**
 * Reads the Clerk publishable key from Nuxt runtime config
 * (NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY).
 */
export function getAppVersion(): AppVersion {
  const config = useRuntimeConfig()
  return deriveVersionFromClerkKey(config.public.clerk?.publishableKey)
}
