/**
 * Central pricing configuration.
 *
 * Display prices live here so they can be updated in one place.
 * Stripe Price IDs must always come from environment variables — never hardcode them here.
 */
export const PRICING = {
  trial: {
    label: 'Free Trial',
    durationDays: 30,
    description: '30 days of unlimited access. No credit card required.',
  },
  monthly: {
    label: 'Monthly',
    /** Display price for the user — must match what is set in Stripe */
    price: '€4.99',
    period: '/month',
    planKey: 'monthly' as const,
    popular: false,
  },
  yearly: {
    label: 'Annual',
    /** Display price for the user — must match what is set in Stripe */
    price: '€39.99',
    period: '/year',
    monthlyEquivalent: '€3.33/month',
    savings: 'Save 33%',
    planKey: 'yearly' as const,
    popular: true,
  },
} as const

export type PlanKey = 'monthly' | 'yearly'
