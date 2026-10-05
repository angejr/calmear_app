/**
 * Google Tag Manager dataLayer events. Safe to call when GTM is not
 * configured: the events are queued in window.dataLayer and ignored.
 * Never put personal data (email, names, IDs) in event parameters.
 */

type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] }

export function trackEvent(event: string, params: Record<string, unknown> = {}): void {
  if (import.meta.server) return
  const w = window as DataLayerWindow
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ event, ...params })
}

/** A CalmEar account created this recently, seen for the first time here, counts as a sign-up. */
const SIGN_UP_WINDOW_MS = 30 * 60 * 1000
const trackedThisSession = new Set<string>()

/**
 * Pushes `sign_up` once per new CalmEar account. The account is created on the
 * first /api/user/me call after the Clerk sign-up (the dashboard), so a recent
 * createdAt identifies a sign-up; a localStorage flag stops reloads and later
 * visits from counting it again.
 */
export function trackSignUpOnce(user: { id: string, createdAt: string }): void {
  if (import.meta.server) return
  const age = Date.now() - new Date(user.createdAt).getTime()
  if (!Number.isFinite(age) || age > SIGN_UP_WINDOW_MS) return

  const key = `calmear_signup_tracked_${user.id}`
  if (trackedThisSession.has(key)) return
  trackedThisSession.add(key)
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
  }
  catch {
    // Storage blocked: the in-memory set still prevents duplicates on this page.
  }
  trackEvent('sign_up', { method: 'clerk' })
}
