<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Authorize CalmEar Extension' })

const route = useRoute()
const state = route.query.state as string | undefined
const redirectUri = route.query.redirect_uri as string | undefined

const loading = ref(true)
const error = ref<string | null>(null)

function isValidRedirectUri(uri: string): boolean {
  return uri.startsWith('chrome-extension://') && uri.endsWith('/auth/callback.html')
}

onMounted(async () => {
  if (!state || !redirectUri || !isValidRedirectUri(redirectUri)) {
    error.value = 'Invalid authorization request. Please try again from the extension.'
    loading.value = false
    return
  }

  try {
    const res = await $fetch<{ code: string; expiresAt: string }>('/api/extension/authorize', {
      method: 'POST',
      body: { redirectUri },
    })
    // Redirect to the extension callback page with the short-lived code and state.
    window.location.href = `${redirectUri}?code=${encodeURIComponent(res.code)}&state=${encodeURIComponent(state)}`
  }
  catch (e: unknown) {
    error.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Authorization failed. Please close this tab and try again.'
    loading.value = false
  }
})
</script>

<template>
  <div class="py-10 sm:py-16">
    <div class="mx-auto max-w-md px-4 sm:px-6 lg:px-8 text-center">
      <div class="card p-10">
        <div class="text-4xl mb-4">🔌</div>
        <h1 class="text-2xl font-bold text-neutral-900 mb-2">Connect CalmEar</h1>
        <p v-if="loading && !error" class="text-neutral-600 mb-6">
          Authorizing your browser extension…
        </p>
        <p v-else-if="error" class="text-red-600 mb-6">{{ error }}</p>
        <div v-if="loading && !error" class="flex justify-center">
          <span class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
        </div>
      </div>
    </div>
  </div>
</template>
