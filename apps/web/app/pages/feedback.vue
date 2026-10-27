<script setup lang="ts">
/**
 * Opened from the extension popup's "Send feedback" link, and linked in the footer.
 */
import { FEEDBACK_TOPICS } from '../../config/feedback'

useSeoMeta({
  title: 'Send feedback to CalmEar',
  description: 'Report a problem, a mouth sound CalmEar missed, or share an idea.',
  robots: 'noindex',
})
</script>

<template>
  <div class="py-16 sm:py-24">
    <div class="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-10">
        <h1 class="text-3xl sm:text-4xl font-bold text-neutral-900 mb-4">Send feedback</h1>
        <p class="text-lg text-neutral-600">
          A problem, a mouth sound CalmEar missed, an idea: I read every message.
        </p>
        <p class="mt-3 text-sm text-neutral-500">
          If CalmEar missed sounds in a video, include its link and the time (e.g. 2:15): it helps me improve detection.
        </p>
      </div>

      <FeedbackForm
        source="feedback"
        :options="FEEDBACK_TOPICS"
        question="What is it about?"
        message-label="Your message"
        prefill-email
      />
    </div>
  </div>
</template>
