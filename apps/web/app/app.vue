<script setup lang="ts">
// Preload the Latin subset of the self-hosted Inter font (used above the fold),
// so the browser fetches it with the CSS instead of after parsing it.
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'

useHead({
  link: [{ rel: 'preload', as: 'font', type: 'font/woff2', href: interLatin, crossorigin: '' }],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
