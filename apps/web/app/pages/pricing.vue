<script setup lang="ts">
import { PRICING } from '../../config/pricing'
useSeoMeta({
  title: 'CalmEar Pricing — Start free, upgrade when ready',
  description: 'CalmEar: 30-day free trial, no credit card. Then €4.99/month or €39.99/year.',
})
const { isSignedIn } = useUser()
const features = ['Real-time mouth-sound reduction','Works on all YouTube videos','Local audio processing (private)','No audio uploaded to servers','Chrome extension included','Priority support']
const faqs = [
  { q: 'Do I need a credit card for the free trial?', a: 'No. Your 30-day trial starts immediately when you create a CalmEar account. No payment information required.' },
  { q: 'What happens after the trial?', a: 'After 30 days you can subscribe to CalmEar Premium to continue. We will not charge you automatically.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel at any time from the billing portal — no questions asked.' },
  { q: 'Is my audio private?', a: 'Completely. All audio processing happens locally in your browser. CalmEar never uploads your audio.' },
]
</script>

<template>
  <div class="py-20 sm:py-28">
    <div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <h1 class="text-4xl sm:text-5xl font-bold text-neutral-900 mb-4">Simple, transparent pricing</h1>
        <p class="text-lg text-neutral-600 max-w-xl mx-auto">Start with a free trial. No credit card required. Upgrade when you're ready.</p>
      </div>

      <div class="grid sm:grid-cols-3 gap-8 items-start">
        <div class="card p-8 flex flex-col">
          <div class="text-3xl mb-4">🎁</div>
          <div class="text-sm font-semibold text-primary-600 uppercase tracking-widest mb-2">Free Trial</div>
          <div class="text-4xl font-bold text-neutral-900 mb-1">{{ PRICING.trial.durationDays }} days</div>
          <div class="text-sm text-neutral-500 mb-6">Unlimited access. No card needed.</div>
          <ul class="space-y-3 mb-8 flex-1">
            <li v-for="f in features" :key="f" class="flex items-start gap-2 text-sm text-neutral-700">
              <svg class="h-4 w-4 text-primary-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>{{ f }}
            </li>
          </ul>
          <SignUpButton v-if="!isSignedIn" mode="modal"><button class="btn-outline w-full justify-center">Start Free Trial</button></SignUpButton>
          <NuxtLink v-else to="/dashboard" class="btn-outline w-full justify-center text-center">Go to Dashboard</NuxtLink>
        </div>

        <div class="card p-8 flex flex-col">
          <div class="text-3xl mb-4">📅</div>
          <div class="text-sm font-semibold text-neutral-500 uppercase tracking-widest mb-2">Monthly</div>
          <div class="flex items-end gap-1 mb-1">
            <span class="text-4xl font-bold text-neutral-900">{{ PRICING.monthly.price }}</span>
            <span class="text-neutral-500 mb-1">{{ PRICING.monthly.period }}</span>
          </div>
          <div class="text-sm text-neutral-500 mb-6">Billed monthly, cancel anytime.</div>
          <ul class="space-y-3 mb-8 flex-1">
            <li v-for="f in features" :key="f" class="flex items-start gap-2 text-sm text-neutral-700">
              <svg class="h-4 w-4 text-primary-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>{{ f }}
            </li>
          </ul>
          <SignUpButton v-if="!isSignedIn" mode="modal"><button class="btn-secondary w-full justify-center">Get Started</button></SignUpButton>
          <NuxtLink v-else to="/dashboard" class="btn-secondary w-full justify-center text-center">Subscribe Monthly</NuxtLink>
        </div>

        <div class="card p-8 flex flex-col ring-2 ring-primary-500 relative">
          <div class="absolute -top-4 left-1/2 -translate-x-1/2">
            <span class="inline-flex items-center rounded-full bg-primary-600 px-4 py-1.5 text-xs font-bold text-white shadow">Most Popular · {{ PRICING.yearly.savings }}</span>
          </div>
          <div class="text-3xl mb-4">🌟</div>
          <div class="text-sm font-semibold text-primary-600 uppercase tracking-widest mb-2">Annual</div>
          <div class="flex items-end gap-1 mb-1">
            <span class="text-4xl font-bold text-neutral-900">{{ PRICING.yearly.price }}</span>
            <span class="text-neutral-500 mb-1">{{ PRICING.yearly.period }}</span>
          </div>
          <div class="text-sm text-neutral-500 mb-6">{{ PRICING.yearly.monthlyEquivalent }} · Save vs monthly</div>
          <ul class="space-y-3 mb-8 flex-1">
            <li v-for="f in features" :key="f" class="flex items-start gap-2 text-sm text-neutral-700">
              <svg class="h-4 w-4 text-primary-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>{{ f }}
            </li>
          </ul>
          <SignUpButton v-if="!isSignedIn" mode="modal"><button class="btn-primary w-full justify-center">Get Started</button></SignUpButton>
          <NuxtLink v-else to="/dashboard" class="btn-primary w-full justify-center text-center">Subscribe Annually</NuxtLink>
        </div>
      </div>

      <div class="mt-20">
        <h2 class="text-2xl font-bold text-neutral-900 mb-8 text-center">Frequently asked questions</h2>
        <div class="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <div v-for="faq in faqs" :key="faq.q" class="card p-6">
            <h3 class="font-semibold text-neutral-900 mb-2">{{ faq.q }}</h3>
            <p class="text-sm text-neutral-600 leading-relaxed">{{ faq.a }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
