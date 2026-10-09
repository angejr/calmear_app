<script setup lang="ts">
/**
 * One step of the landing page's "Get Started" section. The parent wraps it
 * in a link or button when the step is actionable (`action` set): the title
 * then gets the link colour and an arrow (external icon for other sites).
 */
defineProps<{
  number: number
  emoji: string
  title: string
  description: string
  action?: 'internal' | 'external'
}>()
</script>

<template>
  <div class="text-center">
    <div
      class="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 text-2xl transition-transform"
      :class="action ? 'group-hover:scale-105' : ''"
    >
      {{ emoji }}
    </div>
    <div class="text-xs font-bold text-primary-600 uppercase tracking-widest mb-2">Step {{ number }}</div>
    <h3
      class="mb-2 inline-flex items-center gap-1.5 text-lg font-semibold"
      :class="action ? 'text-primary-700 group-hover:text-primary-800 group-hover:underline underline-offset-4' : 'text-neutral-900'"
    >
      {{ title }}
      <svg v-if="action === 'external'" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
      <svg v-else-if="action === 'internal'" class="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
    </h3>
    <p class="text-sm text-neutral-600 leading-relaxed">{{ description }}</p>
  </div>
</template>
