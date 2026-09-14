<script setup lang="ts">
import { PRICING } from '../../config/pricing'
const { isSignedIn } = useUser()
useSeoMeta({
  title: 'CalmEar — Enjoy YouTube without distracting mouth sounds',
  description: 'CalmEar detects and reduces mouth smacks in your browser. 30-day free trial.',
})
const steps = [
  { number: 1, emoji: '🧩', title: 'Install CalmEar', description: 'Add the CalmEar extension to Chrome from the Chrome Web Store.' },
  { number: 2, emoji: '🔐', title: 'Sign in to your account', description: 'Create a free CalmEar account. Your 30-day trial starts automatically.' },
  { number: 3, emoji: '🎬', title: 'Watch in peace', description: 'Open any YouTube video. CalmEar silently reduces mouth sounds in real time.' },
]
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="bg-gradient-to-b from-primary-50 to-white pt-16 pb-24 sm:pt-24 sm:pb-32">
      <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <div class="inline-flex items-center gap-2 rounded-full bg-primary-100 px-4 py-1.5 text-xs font-semibold text-primary-700 mb-8">
          <span class="h-1.5 w-1.5 rounded-full bg-primary-500" />
          {{ PRICING.trial.durationDays }}-day free trial · No credit card required
        </div>
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-neutral-900 leading-tight">
          Enjoy YouTube without<br /><span class="text-primary-600">distracting mouth sounds.</span>
        </h1>
        <p class="mt-6 text-lg sm:text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed">
          CalmEar detects and reduces mouth smacks directly in your browser — so you can focus on what you want to watch.
        </p>
        <div class="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <NuxtLink v-if="isSignedIn" to="/dashboard" class="btn-primary text-base px-8 py-4">Go to Dashboard</NuxtLink>
          <SignUpButton v-else mode="modal"><button class="btn-primary text-base px-8 py-4">Try CalmEar Free</button></SignUpButton>
          <NuxtLink to="#how-it-works" class="btn-secondary text-base px-8 py-4">See How It Works</NuxtLink>
        </div>
        <p class="mt-4 text-sm text-neutral-500">{{ PRICING.trial.durationDays }}-day free trial · No credit card required</p>
      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="py-20 sm:py-28">
      <div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-14">
          <h2 class="text-3xl sm:text-4xl font-bold text-neutral-900">How it works</h2>
          <p class="mt-3 text-neutral-600">Get started in three simple steps.</p>
        </div>
        <div class="grid sm:grid-cols-3 gap-8">
          <div v-for="step in steps" :key="step.number" class="text-center">
            <div class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 text-2xl">{{ step.emoji }}</div>
            <div class="text-xs font-bold text-primary-600 uppercase tracking-widest mb-2">Step {{ step.number }}</div>
            <h3 class="text-lg font-semibold text-neutral-900 mb-2">{{ step.title }}</h3>
            <p class="text-sm text-neutral-600 leading-relaxed">{{ step.description }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Privacy -->
    <section class="bg-neutral-50 py-20 sm:py-28">
      <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div class="card border-primary-100 bg-white text-center p-10 sm:p-14">
          <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-3xl">🔒</div>
          <h2 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-4">Your audio stays on your device.</h2>
          <p class="text-neutral-600 max-w-xl mx-auto leading-relaxed">
            Audio processing happens entirely in your browser using local machine learning.
            CalmEar does not upload the audio you're watching to our servers.
          </p>
          <div class="mt-8 flex flex-wrap justify-center gap-6 text-sm text-neutral-500">
            <span class="flex items-center gap-2"><svg class="h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>No audio uploaded</span>
            <span class="flex items-center gap-2"><svg class="h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Local ML inference</span>
            <span class="flex items-center gap-2"><svg class="h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Works offline</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing preview -->
    <section class="py-20 sm:py-28">
      <div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl sm:text-4xl font-bold text-neutral-900 mb-3">Simple, transparent pricing</h2>
        <p class="text-neutral-600 mb-12">Start free. Upgrade when you're ready.</p>
        <div class="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div class="card flex flex-col items-center text-center p-8">
            <div class="text-2xl mb-3">🎁</div>
            <div class="text-sm font-semibold text-primary-600 mb-1">Free Trial</div>
            <div class="text-3xl font-bold text-neutral-900 mb-1">{{ PRICING.trial.durationDays }} days</div>
            <div class="text-sm text-neutral-500 mb-6">No credit card required</div>
            <NuxtLink v-if="isSignedIn" to="/dashboard" class="btn-outline text-sm py-2 px-5 w-full text-center">Go to Dashboard</NuxtLink><SignUpButton v-else mode="modal"><button class="btn-outline text-sm py-2 px-5 w-full">Start Free Trial</button></SignUpButton>
          </div>
          <div class="card flex flex-col items-center text-center p-8">
            <div class="text-2xl mb-3">📅</div>
            <div class="text-sm font-semibold text-neutral-600 mb-1">Monthly</div>
            <div class="text-3xl font-bold text-neutral-900 mb-1">{{ PRICING.monthly.price }}</div>
            <div class="text-sm text-neutral-500 mb-6">per month</div>
            <NuxtLink v-if="isSignedIn" to="/dashboard" class="btn-secondary text-sm py-2 px-5 w-full text-center">Go to Dashboard</NuxtLink><SignUpButton v-else mode="modal"><button class="btn-secondary text-sm py-2 px-5 w-full">Get Started</button></SignUpButton>
          </div>
          <div class="card flex flex-col items-center text-center p-8 ring-2 ring-primary-500 relative">
            <div class="absolute -top-3 left-1/2 -translate-x-1/2"><span class="inline-flex items-center rounded-full bg-primary-600 px-3 py-1 text-xs font-bold text-white">{{ PRICING.yearly.savings }}</span></div>
            <div class="text-2xl mb-3">🌟</div>
            <div class="text-sm font-semibold text-primary-600 mb-1">Annual</div>
            <div class="text-3xl font-bold text-neutral-900 mb-1">{{ PRICING.yearly.price }}</div>
            <div class="text-sm text-neutral-500 mb-6">{{ PRICING.yearly.monthlyEquivalent }}</div>
            <NuxtLink v-if="isSignedIn" to="/dashboard" class="btn-primary text-sm py-2 px-5 w-full text-center">Get Started</NuxtLink><SignUpButton v-else mode="modal"><button class="btn-primary text-sm py-2 px-5 w-full">Get Started</button></SignUpButton>
          </div>
        </div>
        <p class="mt-8"><NuxtLink to="/pricing" class="text-sm text-primary-600 hover:text-primary-700 font-medium">See full pricing details →</NuxtLink></p>
      </div>
    </section>

    <!-- CTA -->
    <section class="bg-primary-600 py-20">
      <div class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to enjoy your content in peace?</h2>
        <p class="text-primary-100 mb-8 text-lg">Try CalmEar free for {{ PRICING.trial.durationDays }} days.</p>
        <NuxtLink v-if="isSignedIn" to="/dashboard" class="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary-700 shadow-md hover:bg-primary-50 transition-colors">Go to Dashboard</NuxtLink>
        <SignUpButton v-else mode="modal"><button class="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary-700 shadow-md hover:bg-primary-50 transition-colors">
            Try free for {{ PRICING.trial.durationDays }} days
          </button></SignUpButton>
      </div>
    </section>
  </div>
</template>
