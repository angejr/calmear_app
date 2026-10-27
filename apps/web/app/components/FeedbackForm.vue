<script setup lang="ts">
/**
 * Form shared by /feedback and /uninstalled: one choice from `options`, an
 * optional message and an optional email for a reply. Posts to /api/feedback.
 *
 * The hidden "website" field is a honeypot: people never see it, bots fill it.
 */
import { FEEDBACK_LIMITS } from '../../config/feedback'
import type { FeedbackSource } from '../../config/feedback'

const props = withDefaults(defineProps<{
  source: FeedbackSource
  options: ReadonlyArray<{ key: string, label: string }>
  question: string
  messageLabel: string
  submitLabel?: string
  extensionVersion?: string | null
  /** Fill the email field with the signed-in user's address */
  prefillEmail?: boolean
}>(), { submitLabel: 'Send', extensionVersion: null, prefillEmail: false })

const reason = ref('')
const message = ref('')
const email = ref('')
const website = ref('')
const status = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')
const errorText = ref('')

const { user } = useUser()
watch(() => user.value?.primaryEmailAddress?.emailAddress, (address) => {
  if (props.prefillEmail && address && !email.value) email.value = address
}, { immediate: true })

const canSubmit = computed(() => status.value !== 'sending' && (reason.value !== '' || message.value.trim() !== ''))

async function submit() {
  if (!canSubmit.value) return
  status.value = 'sending'
  errorText.value = ''
  try {
    await $fetch('/api/feedback', {
      method: 'POST',
      body: {
        source: props.source,
        reason: reason.value || null,
        message: message.value,
        email: email.value,
        extensionVersion: props.extensionVersion,
        website: website.value,
      },
    })
    status.value = 'sent'
  }
  catch (err) {
    const statusMessage = (err as { statusMessage?: string })?.statusMessage
    errorText.value = statusMessage && statusMessage.length < 120
      ? statusMessage
      : 'Your message could not be sent. Please try again in a moment.'
    status.value = 'error'
  }
}
</script>

<template>
  <div class="card p-6 sm:p-8" aria-live="polite">
    <div v-if="status === 'sent'" class="text-center py-6">
      <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-700">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
      </div>
      <p class="text-lg font-semibold text-neutral-900 mb-1">Thank you</p>
      <p class="text-sm text-neutral-600">
        Your message has reached me.<template v-if="email.trim()"> I'll reply to {{ email.trim() }} if needed.</template>
      </p>
    </div>

    <form v-else class="space-y-6" @submit.prevent="submit">
      <fieldset>
        <legend class="font-semibold text-neutral-900 mb-3">{{ question }}</legend>
        <div class="space-y-2">
          <label
            v-for="option in options"
            :key="option.key"
            class="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors"
            :class="reason === option.key ? 'border-primary-500 bg-primary-50 text-neutral-900' : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'"
          >
            <input v-model="reason" type="radio" name="reason" :value="option.key" class="h-4 w-4 accent-primary-600">
            {{ option.label }}
          </label>
        </div>
      </fieldset>

      <div>
        <label for="feedback-message" class="block font-semibold text-neutral-900 mb-2">{{ messageLabel }}</label>
        <textarea
          id="feedback-message"
          v-model="message"
          rows="5"
          :maxlength="FEEDBACK_LIMITS.message"
          class="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          placeholder="Optional"
        />
      </div>

      <div>
        <label for="feedback-email" class="block font-semibold text-neutral-900 mb-1">Your email</label>
        <p class="text-xs text-neutral-500 mb-2">Optional. Only if you'd like a reply; it isn't used for anything else.</p>
        <input
          id="feedback-email"
          v-model="email"
          type="email"
          autocomplete="email"
          :maxlength="FEEDBACK_LIMITS.email"
          class="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          placeholder="you@example.com"
        >
      </div>

      <!-- Honeypot: hidden from people and screen readers -->
      <div class="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label>Website <input v-model="website" type="text" name="website" tabindex="-1" autocomplete="off"></label>
      </div>

      <p v-if="status === 'error'" class="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{{ errorText }}</p>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs text-neutral-500">
          Read by Ange, CalmEar's founder. See our <NuxtLink to="/privacy#feedback" class="underline hover:text-neutral-700">privacy policy</NuxtLink>.
        </p>
        <button type="submit" class="btn-primary" :disabled="!canSubmit">
          {{ status === 'sending' ? 'Sending…' : submitLabel }}
        </button>
      </div>
    </form>
  </div>
</template>
