<script setup lang="ts">
useSeoMeta({
  title: 'Download CalmEar — Chrome Extension',
  description: 'Install the CalmEar Chrome extension and connect it to your account.',
})
</script>

<template>
  <div class="py-20 sm:py-28">
    <div class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <div class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-100 text-4xl">🧩</div>
        <h1 class="text-4xl font-bold text-neutral-900 mb-4">Install CalmEar</h1>
        <p class="text-lg text-neutral-600">Get started in a few minutes. Free for 30 days.</p>
      </div>

      <div class="space-y-6">
        <div class="card p-6 flex gap-5">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 font-bold text-primary-700">1</div>
          <div>
            <h3 class="font-semibold text-neutral-900 mb-1">Install the Chrome extension</h3>
            <p class="text-sm text-neutral-600 mb-3">Add CalmEar from the Chrome Web Store.</p>
            <a
              href="https://chrome.google.com/webstore"
              target="_blank"
              rel="noopener"
              class="btn-primary text-sm py-2 px-5 inline-flex"
            >
              Open Chrome Web Store
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
            </a>
          </div>
        </div>

        <div class="card p-6 flex gap-5">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 font-bold text-primary-700">2</div>
          <div>
            <h3 class="font-semibold text-neutral-900 mb-1">Create a CalmEar account</h3>
            <p class="text-sm text-neutral-600 mb-3">Sign up for free. Your 30-day trial starts automatically — no credit card required.</p>
            <SignUpButton mode="modal">
              <button class="btn-outline text-sm py-2 px-5">Create free account</button>
            </SignUpButton>
          </div>
        </div>

        <div class="card p-6 flex gap-5">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 font-bold text-primary-700">3</div>
          <div>
            <h3 class="font-semibold text-neutral-900 mb-1">Connect the extension to your account</h3>
            <p class="text-sm text-neutral-600 mb-3">
              Go to your dashboard, click <strong>Connect Chrome Extension</strong>, and enter the
              one-time pairing code in the CalmEar extension popup.
            </p>
            <NuxtLink to="/dashboard" class="btn-secondary text-sm py-2 px-5 inline-flex">Go to Dashboard</NuxtLink>
          </div>
        </div>

        <div class="card p-6 flex gap-5">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 font-bold text-primary-700">4</div>
          <div>
            <h3 class="font-semibold text-neutral-900 mb-1">Watch YouTube in peace</h3>
            <p class="text-sm text-neutral-600">
              Open any YouTube video. CalmEar will silently detect and reduce mouth sounds in real time.
              You can toggle it on or off from the extension popup at any time.
            </p>
          </div>
        </div>
      </div>

      <div class="mt-10 card bg-primary-50 border-primary-100 p-6 text-center">
        <p class="text-sm text-neutral-700">
          <span class="font-semibold">🔒 Privacy note:</span>
          All audio processing happens locally in your browser.
          CalmEar never uploads or records the audio you listen to.
        </p>
      </div>
    </div>
  </div>
</template>
