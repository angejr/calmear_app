/**
 * Route middleware that redirects unauthenticated users to the home page.
 *
 * Used by definePageMeta({ middleware: 'auth' }) in protected pages.
 *
 * Uses useAuth(), not useUser(): before Clerk's browser script has loaded
 * (server rendering, first client render), useAuth() already knows whether
 * the visitor is signed in from the server's initial auth state, while
 * useUser() stays "not loaded" until the full user object arrives. Waiting on
 * useUser() meant this middleware never redirected on a direct visit.
 *
 * Note: This middleware provides UX convenience only.
 * Every protected server endpoint independently validates authentication
 * server-side — never trust frontend route guards alone.
 */
const CLERK_LOAD_TIMEOUT_MS = 10_000

export default defineNuxtRouteMiddleware(async () => {
  const { isLoaded, isSignedIn } = useAuth()

  // Without a server auth state (should not happen with Clerk's server
  // middleware enabled), wait in the browser for Clerk to load.
  if (!isLoaded.value && import.meta.client) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { stop(); resolve() }, CLERK_LOAD_TIMEOUT_MS)
      const stop = watch(isLoaded, (loaded) => {
        if (!loaded) return
        clearTimeout(timer)
        stop()
        resolve()
      })
    })
  }

  if (isLoaded.value && !isSignedIn.value) {
    return navigateTo('/', { replace: true })
  }
})
