<script setup lang="ts">
/**
 * Main call to action: opens Clerk's sign-up window (account first; the
 * dashboard then walks the user through installing the extension). Signed-in
 * users get a link to their dashboard instead.
 *
 * Opening the sign-up window pushes `signup_open` to the GTM dataLayer with
 * where on the page it was clicked; the `sign_up` conversion itself is sent
 * by the dashboard once the account exists (utils/analytics.ts).
 */
const props = withDefaults(defineProps<{
  /** Where the button is on the page, sent with the event (e.g. 'hero'). */
  location: string
  variant?: 'primary' | 'white'
}>(), { variant: 'primary' })

const { isSignedIn } = useUser()

const buttonClass = computed(() => props.variant === 'white'
  ? 'inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary-700 shadow-md transition-colors hover:bg-primary-50'
  : 'btn-primary px-8 py-4 text-base')

function onClick() {
  trackEvent('signup_open', { cta_location: props.location })
}
</script>

<template>
  <NuxtLink v-if="isSignedIn" to="/dashboard" :class="buttonClass">Go to your dashboard</NuxtLink>
  <SignUpButton v-else mode="modal">
    <button type="button" :class="buttonClass" @click="onClick">
      <slot>Start your free trial</slot>
    </button>
  </SignUpButton>
</template>
