/**
 * Google Tag Manager dataLayer events. Safe to call when GTM is not
 * configured: the events are queued in window.dataLayer and ignored.
 * Never put personal data (email, names, IDs) in event parameters.
 */
import { PRICING, type PlanKey } from '../../config/pricing'

type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] }

function pushDataLayer(entry: Record<string, unknown>): void {
  if (import.meta.server) return
  const w = window as DataLayerWindow
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push(entry)
}

export function trackEvent(event: string, params: Record<string, unknown> = {}): void {
  pushDataLayer({ event, ...params })
}

/** A CalmEar account created this recently, seen for the first time here, counts as a sign-up. */
const SIGN_UP_WINDOW_MS = 30 * 60 * 1000
const trackedThisSession = new Set<string>()

/** Longest wait for GTM to process an event before a page navigates away. */
const TAG_WAIT_MS = 1500

/**
 * Pushes `sign_up` once per new CalmEar account. The account is created on
 * the first call to /api/user/me (dashboard) or /api/extension/authorize
 * (sign-in from the extension), so a recent createdAt identifies a sign-up; a
 * localStorage flag stops reloads and later visits from counting it again.
 *
 * Resolves once GTM has run its tags for the event (or after TAG_WAIT_MS, e.g.
 * when GTM is blocked), so a page that redirects right after can await it.
 * Resolves immediately when nothing is tracked.
 */
export function trackSignUpOnce(user: { id: string, createdAt: string }): Promise<void> {
  if (import.meta.server) return Promise.resolve()
  const age = Date.now() - new Date(user.createdAt).getTime()
  if (!Number.isFinite(age) || age > SIGN_UP_WINDOW_MS) return Promise.resolve()

  const key = `calmear_signup_tracked_${user.id}`
  if (trackedThisSession.has(key)) return Promise.resolve()
  trackedThisSession.add(key)
  try {
    if (localStorage.getItem(key)) return Promise.resolve()
    localStorage.setItem(key, '1')
  }
  catch {
    // Storage blocked: the in-memory set still prevents duplicates on this page.
  }
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, TAG_WAIT_MS)
    pushDataLayer({
      event: 'sign_up',
      method: 'clerk',
      // GTM calls this after its tags have fired for the event.
      eventCallback: () => { clearTimeout(timer); resolve() },
      eventTimeout: TAG_WAIT_MS,
    })
  })
}

/** Plan chosen before leaving for Stripe Checkout, read back on the success return. */
const PENDING_PURCHASE_KEY = 'calmear_pending_purchase'

export function rememberCheckoutPlan(plan: PlanKey): void {
  if (import.meta.server) return
  try {
    sessionStorage.setItem(PENDING_PURCHASE_KEY, plan)
  }
  catch {
    // Storage blocked: the purchase will not be tracked.
  }
}

function takePendingPlan(): string | null {
  try {
    const plan = sessionStorage.getItem(PENDING_PURCHASE_KEY)
    sessionStorage.removeItem(PENDING_PURCHASE_KEY)
    return plan
  }
  catch {
    return null
  }
}

/**
 * Pushes `purchase` (GA4 ecommerce format, as Reddit's GTM setup expects) once,
 * when the visitor comes back from a successful Stripe Checkout. The stored
 * plan is cleared, so reloading the success page does not count it again.
 * Prices come from config/pricing.ts (which must match Stripe).
 */
export function trackPurchaseOnce(): void {
  if (import.meta.server) return
  const plan = takePendingPlan()
  if (plan !== 'monthly' && plan !== 'yearly') return

  const price = Number(PRICING[plan].price.replace(/[^0-9.]/g, ''))
  pushDataLayer({ ecommerce: null }) // Clear the previous ecommerce object.
  pushDataLayer({
    event: 'purchase',
    ecommerce: {
      value: price,
      currency: 'EUR',
      items: [{
        item_id: `calmear-premium-${plan}`,
        item_name: `CalmEar Premium (${PRICING[plan].label})`,
        item_category: 'Subscription',
        price,
        quantity: 1,
      }],
    },
  })
}
