import { describe, it, expect } from 'vitest'
import { computeEntitlement } from '../server/services/entitlement'
import type { User } from '../drizzle/schema'

/** Creates a minimal User fixture with sensible defaults */
function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date()
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  return {
    id: 'user-test-id',
    clerkUserId: 'clerk-test-id',
    email: 'test@example.com',
    trialStartedAt: past,
    trialEndsAt: future,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: 'none',
    subscriptionCurrentPeriodEnd: null,
    createdAt: past,
    updatedAt: past,
    ...overrides,
  }
}

describe('computeEntitlement', () => {
  describe('trial', () => {
    it('returns trial plan when within trial window', () => {
      const user = makeUser()
      const result = computeEntitlement(user)
      expect(result.active).toBe(true)
      expect(result.plan).toBe('trial')
      expect(result.authenticated).toBe(true)
      expect(result.trialEndsAt).not.toBeNull()
      expect(result.subscriptionEndsAt).toBeNull()
    })

    it('returns free plan when trial has expired', () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const user = makeUser({ trialEndsAt: past })
      const result = computeEntitlement(user)
      expect(result.active).toBe(false)
      expect(result.plan).toBe('free')
    })

    it('returns free plan when no trial dates are set', () => {
      const user = makeUser({ trialStartedAt: null, trialEndsAt: null })
      const result = computeEntitlement(user)
      expect(result.active).toBe(false)
      expect(result.plan).toBe('free')
    })
  })

  describe('premium', () => {
    it('returns premium plan for active subscription', () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const user = makeUser({
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_test',
        subscriptionCurrentPeriodEnd: future,
      })
      const result = computeEntitlement(user)
      expect(result.active).toBe(true)
      expect(result.plan).toBe('premium')
      expect(result.subscriptionEndsAt).not.toBeNull()
    })

    it('returns premium when subscriptionCurrentPeriodEnd is null (Stripe Basil API)', () => {
      // Stripe Basil API moved current_period_end to sub.items.data[0].
      // subscriptionCurrentPeriodEnd may be null in DB — access must still be granted.
      const user = makeUser({
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_test',
        subscriptionCurrentPeriodEnd: null,
      })
      const result = computeEntitlement(user)
      expect(result.active).toBe(true)
      expect(result.plan).toBe('premium')
    })

    it('premium takes precedence over trial being active', () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      const user = makeUser({
        // Trial is still active
        trialEndsAt: future,
        // But premium subscription is also active
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub_test',
        subscriptionCurrentPeriodEnd: future,
      })
      const result = computeEntitlement(user)
      expect(result.plan).toBe('premium')
      expect(result.active).toBe(true)
    })

    it('returns free plan for canceled subscription with expired period', () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const user = makeUser({
        trialEndsAt: past,
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: 'sub_test',
        subscriptionCurrentPeriodEnd: past,
      })
      const result = computeEntitlement(user)
      expect(result.active).toBe(false)
      expect(result.plan).toBe('free')
    })

    it('returns free plan for past_due subscription with expired period', () => {
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const user = makeUser({
        trialEndsAt: past,
        subscriptionStatus: 'past_due',
        stripeSubscriptionId: 'sub_test',
        subscriptionCurrentPeriodEnd: past,
      })
      const result = computeEntitlement(user)
      expect(result.active).toBe(false)
      expect(result.plan).toBe('free')
    })

    it('returns trial when subscription is canceled but trial is still active', () => {
      const futureTrial = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const user = makeUser({
        trialEndsAt: futureTrial,
        subscriptionStatus: 'canceled',
        subscriptionCurrentPeriodEnd: past,
      })
      const result = computeEntitlement(user)
      expect(result.plan).toBe('trial')
      expect(result.active).toBe(true)
    })
  })

  describe('output shape', () => {
    it('includes ISO string for trialEndsAt when present', () => {
      const user = makeUser()
      const result = computeEntitlement(user)
      expect(typeof result.trialEndsAt).toBe('string')
      expect(result.trialEndsAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })
  })
})
