<script setup lang="ts">
/**
 * Opened by Chrome when the extension is removed (chrome.runtime.setUninstallURL).
 * The extension passes only its version: /uninstalled?v=1.0.2
 */
import logoUrl from '~/assets/images/logo.webp'
import { LINKS } from '../../config/links'
import { UNINSTALL_REASONS } from '../../config/feedback'

useSeoMeta({
  title: 'CalmEar has been removed',
  description: 'Tell us why you removed CalmEar.',
  robots: 'noindex',
})

const route = useRoute()
const extensionVersion = computed(() => typeof route.query.v === 'string' ? route.query.v : null)
</script>

<template>
  <div class="py-16 sm:py-24">
    <div class="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-10">
        <img :src="logoUrl" alt="CalmEar logo" width="64" height="64" class="mx-auto mb-6 h-16 w-16 object-contain rounded-2xl drop-shadow-sm">
        <h1 class="text-3xl sm:text-4xl font-bold text-neutral-900 mb-4">CalmEar has been removed</h1>
        <p class="text-lg text-neutral-600">
          Could you tell me why? It takes a few seconds, and every answer helps me make CalmEar better for people sensitive to mouth sounds.
        </p>
      </div>

      <FeedbackForm
        source="uninstall"
        :options="UNINSTALL_REASONS"
        question="Why did you remove CalmEar?"
        message-label="Anything you'd like to add?"
        submit-label="Send my answer"
        :extension-version="extensionVersion"
      />

      <div class="mt-8 grid gap-4 sm:grid-cols-2">
        <div class="card p-5">
          <h2 class="font-semibold text-neutral-900 mb-1">Your account is still there</h2>
          <p class="text-sm text-neutral-600">
            Removing the extension doesn't delete your account or cancel a subscription.
            You can do both from your <NuxtLink to="/dashboard" class="text-primary-600 hover:underline">dashboard</NuxtLink>.
          </p>
        </div>
        <div class="card p-5">
          <h2 class="font-semibold text-neutral-900 mb-1">Removed it by mistake?</h2>
          <p class="text-sm text-neutral-600 mb-3">Add it again in one click; your account is kept.</p>
          <a :href="LINKS.chromeWebStore" target="_blank" rel="noopener" class="text-sm font-semibold text-primary-600 hover:underline">
            Reinstall CalmEar →
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
