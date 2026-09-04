<script setup lang="ts">
import { useClerk, useUser } from '@clerk/vue'

const { isSignedIn } = useUser()
const { signOut } = useClerk()

const isMenuOpen = ref(false)

async function handleSignOut() {
  await signOut()
  await navigateTo('/')
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Navigation -->
    <header class="sticky top-0 z-50 border-b border-neutral-100 bg-white/95 backdrop-blur-sm">
      <nav class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center gap-2 group">
            <span class="text-2xl" aria-hidden="true">🎧</span>
            <span class="text-lg font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
              CalmEar
            </span>
          </NuxtLink>

          <!-- Desktop nav -->
          <div class="hidden sm:flex items-center gap-6">
            <NuxtLink
              to="/pricing"
              class="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
              active-class="text-primary-600"
            >
              Pricing
            </NuxtLink>
            <NuxtLink
              to="/download"
              class="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
              active-class="text-primary-600"
            >
              Download
            </NuxtLink>

            <template v-if="isSignedIn">
              <NuxtLink to="/dashboard" class="btn-secondary text-xs py-2 px-4">
                Dashboard
              </NuxtLink>
              <UserButton />
            </template>
            <template v-else>
              <SignInButton mode="modal">
                <button class="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors">
                  Login
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button class="btn-primary text-xs py-2 px-4">
                  Try Free
                </button>
              </SignUpButton>
            </template>
          </div>

          <!-- Mobile menu button -->
          <button
            class="sm:hidden p-2 text-neutral-600 hover:text-neutral-900"
            :aria-label="isMenuOpen ? 'Close menu' : 'Open menu'"
            @click="isMenuOpen = !isMenuOpen"
          >
            <svg v-if="!isMenuOpen" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            <svg v-else class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Mobile menu -->
        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="opacity-0 -translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-2"
        >
          <div v-if="isMenuOpen" class="sm:hidden border-t border-neutral-100 py-3 space-y-1">
            <NuxtLink
              to="/pricing"
              class="block px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded-lg"
              @click="isMenuOpen = false"
            >Pricing</NuxtLink>
            <NuxtLink
              to="/download"
              class="block px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded-lg"
              @click="isMenuOpen = false"
            >Download</NuxtLink>
            <div class="pt-2 border-t border-neutral-100 flex flex-col gap-2">
              <template v-if="isSignedIn">
                <NuxtLink to="/dashboard" class="btn-secondary justify-center" @click="isMenuOpen = false">
                  Dashboard
                </NuxtLink>
                <button class="btn-outline justify-center" @click="handleSignOut">Sign out</button>
              </template>
              <template v-else>
                <SignInButton mode="modal">
                  <button class="btn-secondary justify-center w-full" @click="isMenuOpen = false">Login</button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button class="btn-primary justify-center w-full" @click="isMenuOpen = false">Try Free</button>
                </SignUpButton>
              </template>
            </div>
          </div>
        </Transition>
      </nav>
    </header>

    <!-- Page content -->
    <main class="flex-1">
      <slot />
    </main>

    <!-- Footer -->
    <footer class="border-t border-neutral-100 bg-neutral-50">
      <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="text-lg" aria-hidden="true">🎧</span>
            <span class="text-sm font-medium text-neutral-700">CalmEar</span>
          </div>
          <p class="text-xs text-neutral-500">
            Designed for people who are sensitive to mouth sounds.
          </p>
          <div class="flex gap-4 text-xs text-neutral-500">
            <NuxtLink to="/pricing" class="hover:text-neutral-700">Pricing</NuxtLink>
            <NuxtLink to="/download" class="hover:text-neutral-700">Download</NuxtLink>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
