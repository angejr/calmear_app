<script setup lang="ts">
import { PRICING } from '../../config/pricing'
import { LINKS } from '../../config/links'
import logoUrl from '~/assets/images/logo.webp'
const { isSignedIn } = useUser()
useSeoMeta({
  title: 'CalmEar - Watch YouTube without mouth smacking sounds',
  description: 'Chrome extension for misophonia: CalmEar detects mouth smacks and lip smacking in YouTube videos and reduces them as you watch. 30-day free trial.',
})

const steps = {
  install: { number: 1, emoji: '🧩', title: 'Install CalmEar', description: 'Add the CalmEar extension to Chrome from the Chrome Web Store.' },
  account: { number: 2, emoji: '🔐', title: 'Sign in to your account', description: 'Create a free CalmEar account. Your 30-day trial starts automatically.' },
  watch: { number: 3, emoji: '🎬', title: 'Watch in peace', description: 'Open any YouTube video. CalmEar silently reduces mouth sounds in real time.' },
}

/** Clickable step: a card-sized hit area with a hover highlight. */
const stepLinkClass = 'group block w-full rounded-2xl p-4 -m-4 transition-colors hover:bg-primary-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600'
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="bg-gradient-to-b from-primary-50 to-white pt-12 pb-12 sm:pt-16 sm:pb-14">
      <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <img
          :src="logoUrl"
          alt="CalmEar logo"
          width="64"
          height="64"
          class="mx-auto h-16 w-16 object-contain mb-6 drop-shadow-md"
        >
        <div class="inline-flex items-center gap-2 rounded-full bg-primary-100 px-4 py-1.5 text-xs font-semibold text-primary-700 mb-6">
          <span class="h-1.5 w-1.5 rounded-full bg-primary-500" />
          Made for misophonia
        </div>
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-neutral-900 leading-tight">
          Watch YouTube without<br class="hidden sm:inline" /> <span class="text-primary-600">mouth smacking sounds.</span>
        </h1>
        <p class="mt-6 text-lg sm:text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed">
          CalmEar detects mouth smacks and lip smacking in YouTube videos and reduces them as you watch, so the sounds that trigger you fade into the background.
        </p>
        <div class="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <AddToChromeButton location="hero" />
          <NuxtLink to="#get-started" class="btn-secondary text-base px-8 py-4">
            Get Started
            <svg class="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
          </NuxtLink>
        </div>
        <p class="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-neutral-500 sm:gap-x-2">
          <span class="inline-flex items-center gap-1.5">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>
            <span><strong class="font-semibold text-neutral-700">Free Chrome extension for desktop</strong></span>
          </span>
          <span class="hidden sm:inline" aria-hidden="true">·</span>
          <span>{{ PRICING.trial.durationDays }}-day free trial</span>
          <span class="hidden sm:inline" aria-hidden="true">·</span>
          <span>No credit card required</span>
        </p>
      </div>
    </section>

    <!-- Interactive demo -->
    <LazyDemo hydrate-on-visible />

    <!-- Get started -->
    <section id="get-started" class="border-t border-neutral-100 py-20 sm:py-28">
      <div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-14">
          <h2 class="text-3xl sm:text-4xl font-bold text-neutral-900">Get Started</h2>
          <p class="mt-3 text-neutral-600">Get started in three simple steps.</p>
        </div>
        <div class="grid sm:grid-cols-3 gap-8">
          <!-- Step 1: Chrome Web Store (new tab) -->
          <a :href="LINKS.chromeWebStore" target="_blank" rel="noopener" :class="stepLinkClass">
            <LandingGetStartedStep v-bind="steps.install" action="external" />
          </a>
          <!-- Step 2: sign-up window (it also offers "Sign in"); dashboard when already signed in -->
          <NuxtLink v-if="isSignedIn" to="/dashboard" :class="stepLinkClass">
            <LandingGetStartedStep v-bind="steps.account" action="internal" />
          </NuxtLink>
          <SignUpButton v-else mode="modal">
            <button type="button" :class="stepLinkClass">
              <LandingGetStartedStep v-bind="steps.account" action="internal" />
            </button>
          </SignUpButton>
          <!-- Step 3 -->
          <LandingGetStartedStep v-bind="steps.watch" />
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
        <AddToChromeButton location="final" variant="white" />
      </div>
    </section>
  </div>
</template>
