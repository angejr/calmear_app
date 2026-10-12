<script setup lang="ts">
/** Sign-up call to action shown inside the demo card, right under the player. */
import { PRICING } from '../../../config/pricing'
</script>

<template>
  <div class="mt-6 rounded-2xl bg-primary-50/70 p-6 text-center ring-1 ring-inset ring-primary-100">
    <p class="text-lg font-semibold text-neutral-900">Want this on every YouTube video?</p>
    <p class="mt-1 text-sm text-neutral-600">CalmEar does it automatically while you watch.</p>
    <div class="mt-4">
      <StartTrialButton location="demo" />
    </div>
    <p class="mt-3 text-xs text-neutral-500">{{ PRICING.trial.durationDays }}-day free trial · No credit card required · Audio never leaves your device</p>
  </div>
</template>
