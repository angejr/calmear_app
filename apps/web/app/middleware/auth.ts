/**
 * Route middleware that redirects unauthenticated users to the sign-in page.
 *
 * Used by definePageMeta({ middleware: 'auth' }) in protected pages.
 *
 * Note: This middleware provides UX convenience only.
 * Every protected server endpoint independently validates authentication
 * server-side — never trust frontend route guards alone.
 */
export default defineNuxtRouteMiddleware((_to) => {
  const { isSignedIn, isLoaded } = useUser()

  // Wait until Clerk has loaded before making decisions
  if (!isLoaded.value) return

  if (!isSignedIn.value) {
    return navigateTo('/', { replace: true })
  }
})
