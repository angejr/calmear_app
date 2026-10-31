<script setup lang="ts">
// Preload the Latin subset of the self-hosted Inter font (used above the fold),
// so the browser fetches it with the CSS instead of after parsing it.
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'

useHead({
  link: [{ rel: 'preload', as: 'font', type: 'font/woff2', href: interLatin, crossorigin: '' }],
})

// The site answers on both calmear-app.com and www.calmear-app.com: the
// canonical URL tells search engines which one to index (NUXT_PUBLIC_APP_URL).
const route = useRoute()
const appUrl = (useRuntimeConfig().public.appUrl as string).replace(/\/$/, '')
useHead({
  link: [{ rel: 'canonical', key: 'canonical', href: computed(() => `${appUrl}${route.path === '/' ? '/' : route.path.replace(/\/$/, '')}`) }],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
