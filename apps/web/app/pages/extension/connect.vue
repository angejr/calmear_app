<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Connect CalmEar Extension' })
const { data } = await useFetch('/api/user/me')
</script>

<template>
  <div class="py-10 sm:py-16">
    <div class="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
      <div class="card p-10">
        <div class="text-4xl mb-4">🔌</div>
        <h1 class="text-2xl font-bold text-neutral-900 mb-2">Connect your extension</h1>
        <p class="text-neutral-600 mb-8">Open the CalmEar extension popup, click Connect, and paste your pairing code here.</p>
        <NuxtLink to="/dashboard?tab=connect" class="btn-primary inline-block">Open Dashboard</NuxtLink>
      </div>
    </div>
  </div>
</template>
