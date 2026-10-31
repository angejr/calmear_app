<script setup lang="ts">
/**
 * End-of-post call to action: what CalmEar does, its limits, the demo and the trial.
 */
import { PRICING } from '../../../config/pricing'
</script>

<template>
  <aside class="rounded-3xl border border-primary-100 bg-primary-50 p-6 sm:p-8">
    <p class="text-xs font-semibold uppercase tracking-wider text-primary-700">CalmEar</p>
    <h2 class="mt-2 text-xl font-bold text-neutral-900 sm:text-2xl">Mouth sounds in YouTube videos?</h2>
    <p class="mt-3 text-neutral-700">
      CalmEar is a Chrome extension that detects mouth smacks and lip smacking in YouTube videos and reduces
      them as the video plays. The audio is processed on your computer and never uploaded.
    </p>
    <p class="mt-2 text-sm text-neutral-500">
      Works on YouTube, in Chrome on a computer. It reduces mouth sounds; it may not catch every one.
    </p>
    <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <StartTrialButton location="blog" />
      <NuxtLink to="/#demo" class="btn-secondary px-8 py-4 text-base">Hear the before/after</NuxtLink>
    </div>
    <p class="mt-3 text-xs text-neutral-500">{{ PRICING.trial.durationDays }}-day free trial · No credit card required</p>
  </aside>
</template>
