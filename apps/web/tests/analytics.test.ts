import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Store = Record<string, string>

function stubBrowser() {
  const store: Store = {}
  const win: { dataLayer?: Record<string, unknown>[] } = {}
  vi.stubGlobal('window', win)
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v },
  })
  return { win, store }
}

async function loadModule() {
  vi.resetModules()
  return await import('../app/utils/analytics')
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

describe('purchase tracking', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  function stubSession() {
    const win: { dataLayer?: Record<string, unknown>[] } = {}
    const session = new Map<string, string>()
    vi.stubGlobal('window', win)
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => session.get(k) ?? null,
      setItem: (k: string, v: string) => { session.set(k, v) },
      removeItem: (k: string) => { session.delete(k) },
    })
    return { win, session }
  }

  it('pushes one purchase in the ecommerce format after a successful checkout', async () => {
    const { win } = stubSession()
    const { rememberCheckoutPlan, trackPurchaseOnce } = await loadModule()
    rememberCheckoutPlan('yearly')
    trackPurchaseOnce()
    trackPurchaseOnce() // reload of the success page
    expect(win.dataLayer).toEqual([
      { ecommerce: null },
      {
        event: 'purchase',
        ecommerce: {
          value: 39.99,
          currency: 'EUR',
          items: [{ item_id: 'calmear-premium-yearly', item_name: 'CalmEar Premium (Annual)', item_category: 'Subscription', price: 39.99, quantity: 1 }],
        },
      },
    ])
  })

  it('uses the monthly price and pushes nothing without a pending checkout', async () => {
    const { win } = stubSession()
    const { rememberCheckoutPlan, trackPurchaseOnce } = await loadModule()
    trackPurchaseOnce()
    expect(win.dataLayer).toBeUndefined()
    rememberCheckoutPlan('monthly')
    trackPurchaseOnce()
    expect((win.dataLayer![1]!.ecommerce as { value: number }).value).toBe(4.99)
  })
})

describe('trackSignUpOnce', () => {
  beforeEach(() => vi.unstubAllGlobals())
  afterEach(() => vi.unstubAllGlobals())

  it('pushes sign_up for an account created moments ago', async () => {
    const { win } = stubBrowser()
    const { trackSignUpOnce } = await loadModule()
    trackSignUpOnce({ id: 'u1', createdAt: minutesAgo(1) })
    expect(win.dataLayer).toEqual([{ event: 'sign_up', method: 'clerk' }])
  })

  it('does not count the same account twice (reload, later visit)', async () => {
    const { win, store } = stubBrowser()
    let mod = await loadModule()
    mod.trackSignUpOnce({ id: 'u1', createdAt: minutesAgo(1) })
    mod.trackSignUpOnce({ id: 'u1', createdAt: minutesAgo(1) })
    expect(win.dataLayer).toHaveLength(1)

    // Fresh page load: in-memory state is gone, the localStorage flag remains.
    mod = await loadModule()
    mod.trackSignUpOnce({ id: 'u1', createdAt: minutesAgo(2) })
    expect(win.dataLayer).toHaveLength(1)
    expect(store.calmear_signup_tracked_u1).toBe('1')
  })

  it('ignores existing accounts', async () => {
    const { win } = stubBrowser()
    const { trackSignUpOnce } = await loadModule()
    trackSignUpOnce({ id: 'u2', createdAt: minutesAgo(31) })
    trackSignUpOnce({ id: 'u3', createdAt: 'not a date' })
    expect(win.dataLayer).toBeUndefined()
  })

  it('still tracks once when storage is blocked', async () => {
    const win: { dataLayer?: Record<string, unknown>[] } = {}
    vi.stubGlobal('window', win)
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    const { trackSignUpOnce } = await loadModule()
    trackSignUpOnce({ id: 'u4', createdAt: minutesAgo(1) })
    trackSignUpOnce({ id: 'u4', createdAt: minutesAgo(1) })
    expect(win.dataLayer).toEqual([{ event: 'sign_up', method: 'clerk' }])
  })
})
