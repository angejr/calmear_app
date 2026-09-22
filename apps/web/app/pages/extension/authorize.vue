<script setup lang="ts">
useSeoMeta({ title: 'Connect CalmEar Extension' })

const route = useRoute()
const state = route.query.state as string | undefined
const redirectUri = route.query.redirect_uri as string | undefined

const { isSignedIn, isLoaded } = useUser()

const authorizing = ref(false)
const error = ref<string | null>(null)

function isValidRedirectUri(uri: string): boolean {
  return uri.startsWith('chrome-extension://') && uri.endsWith('/auth/callback.html')
}

const invalidRequest = !state || !redirectUri || !isValidRedirectUri(redirectUri)
const invalidRequestMessage = 'Invalid authorization request. Please try again from the extension.'

async function authorize() {
  if (invalidRequest || authorizing.value) return
  authorizing.value = true
  error.value = null
  try {
    const res = await $fetch<{ code: string; expiresAt: string }>('/api/extension/authorize', {
      method: 'POST',
      body: { redirectUri },
    })
    // Redirect to the extension callback page with the short-lived code and state.
    window.location.href = `${redirectUri}?code=${encodeURIComponent(res.code)}&state=${encodeURIComponent(state!)}`
  }
  catch (e: unknown) {
    error.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Authorization failed. Please close this tab and try again.'
    authorizing.value = false
  }
}

// Fires when the user completes sign-in/sign-up in the embedded Clerk form.
watch(isSignedIn, (v) => { if (v) authorize() })

// Fast path: user was already signed in when the tab opened.
onMounted(() => { if (isSignedIn.value) authorize() })
</script>

<template>
  <div class="py-10 sm:py-16">
    <div class="mx-auto max-w-md px-4 sm:px-6 lg:px-8 text-center">
        <template v-if="invalidRequest">
          <h1 class="text-2xl font-bold text-neutral-900 mb-2">Connect CalmEar</h1>
          <p class="text-red-600">{{ invalidRequestMessage }}</p>
        </template>

        <template v-else-if="!isLoaded">
          <h1 class="text-2xl font-bold text-neutral-900 mb-2">Connect CalmEar</h1>
          <p class="text-neutral-600 mb-6">Loading…</p>
          <div class="flex justify-center">
            <span class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        </template>

        <template v-else-if="!isSignedIn">
          <div class="flex justify-center">
            <SignIn
              :fallback-redirect-url="route.fullPath"
              :sign-up-fallback-redirect-url="route.fullPath"
              :sign-up-force-redirect-url="route.fullPath"
            />
          </div>
        </template>

        <template v-else>
          <h1 class="text-2xl font-bold text-neutral-900 mb-2">Connect CalmEar</h1>
          <p v-if="!error" class="text-neutral-600 mb-6">
            Authorizing your browser extension…
          </p>
          <p v-else class="text-red-600 mb-6">{{ error }}</p>
          <div v-if="!error" class="flex justify-center">
            <span class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          </div>
        </template>
    </div>
  </div>
</template>
