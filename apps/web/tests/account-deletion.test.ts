import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import { subscriptionsToCancel } from '../server/services/account-deletion'
import { computeTrialEnd } from '../server/services/users'
import { hashEmail } from '../server/utils/crypto'

describe('subscriptionsToCancel', () => {
  it('cancels every subscription that can still charge the customer', () => {
    const subs = (['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused', 'canceled', 'incomplete_expired'] as Stripe.Subscription.Status[])
      .map((status, i) => ({ id: `sub_${i}_${status}`, status }))
    expect(subscriptionsToCancel(subs)).toEqual([
      'sub_0_active', 'sub_1_trialing', 'sub_2_past_due', 'sub_3_unpaid', 'sub_4_incomplete', 'sub_5_paused',
    ])
  })

  it('returns nothing when there is nothing to cancel', () => {
    expect(subscriptionsToCancel([])).toEqual([])
    expect(subscriptionsToCancel([{ id: 'sub_old', status: 'canceled' }])).toEqual([])
  })
})

describe('hashEmail', () => {
  it('gives the same hash whatever the case or surrounding spaces', () => {
    expect(hashEmail('  Alice@Example.COM ')).toBe(hashEmail('alice@example.com'))
  })

  it('does not contain the email and differs between emails', () => {
    const h = hashEmail('alice@example.com')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(h).not.toBe(hashEmail('bob@example.com'))
  })
})

describe('computeTrialEnd', () => {
  const now = new Date('2026-10-06T12:00:00Z')

  it('gives a new account a 30-day trial', () => {
    expect(computeTrialEnd(now, false).toISOString()).toBe('2026-11-05T12:00:00.000Z')
  })

  it('gives the email of a deleted account no new trial', () => {
    expect(computeTrialEnd(now, true).getTime()).toBe(now.getTime())
  })
})
