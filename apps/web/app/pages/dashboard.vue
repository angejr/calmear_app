<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'CalmEar Dashboard' })

interface Entitlement {
  active: boolean
  plan: 'trial' | 'premium' | 'free'
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
}
interface UserData { id: string; email: string | null; subscriptionStatus: string }

const { data, pending, error, refresh } = await useFetch<{ user: UserData; entitlement: Entitlement }>('/api/user/me')
console.log(data)

const billingLoading = ref<string | null>(null)
const billingError = ref<string | null>(null)

async function subscribe(plan: 'monthly' | 'yearly') {
  billingLoading.value = plan
  billingError.value = null
  try {
    const res = await $fetch<{ url: string }>('/api/billing/checkout', { method: 'POST', body: { plan } })
    window.location.href = res.url
  }
  catch (e: unknown) {
    billingError.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Checkout failed.'
  }
  finally { billingLoading.value = null }
}

async function manageSubscription() {
  billingLoading.value = 'portal'
  billingError.value = null
  try {
    const res = await $fetch<{ url: string }>('/api/billing/portal', { method: 'POST' })
    window.location.href = res.url
  }
  catch (e: unknown) {
    billingError.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Portal failed.'
  }
  finally { billingLoading.value = null }
}

const route = useRoute()
const checkoutSuccess = computed(() => route.query.checkout === 'success')

// After Stripe redirects with ?checkout=success the webhook may arrive a few seconds late.
// Poll every 2s up to 30s until the plan becomes premium, then stop.
const pollTimer = ref(null)
const pollAttempts = ref(0)
const MAX_POLL = 15

onMounted(() => {
  if (checkoutSuccess.value) {
    pollTimer.value = setInterval(async () => {
      pollAttempts.value++
      await refresh()
      if (data.value?.entitlement.plan === 'premium' || pollAttempts.value >= MAX_POLL) {
        clearInterval(pollTimer.value)
        pollTimer.value = null
      }
    }, 2000)
  }
})

onUnmounted(() => {
  if (pollTimer.value) clearInterval(pollTimer.value)
})

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysRemaining(iso?: string | null): number {
  if (!iso) return 0
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
}
</script>

<template>
  <div class="py-10 sm:py-16">
    <div class="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-neutral-900">Your CalmEar account</h1>
          <p class="text-sm text-neutral-500 mt-1">Manage your subscription and extension.</p>
        </div>
        <UserButton />
      </div>

      <div v-if="checkoutSuccess" class="mb-6 rounded-xl border p-4 flex gap-3"
        :class="data?.entitlement.plan === 'premium' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'">
        <span class="text-xl">{{ data?.entitlement.plan === 'premium' ? '✓' : '⏳' }}</span>
        <div>
          <p class="font-semibold" :class="data?.entitlement.plan === 'premium' ? 'text-green-800' : 'text-blue-800'">
            {{ data?.entitlement.plan === 'premium' ? 'Subscription activated!' : 'Confirming your subscription…' }}
          </p>
          <p class="text-sm" :class="data?.entitlement.plan === 'premium' ? 'text-green-700' : 'text-blue-700'">
            {{ data?.entitlement.plan === 'premium' ? 'Premium is now active. The extension picks up changes automatically.' : 'Please wait while we confirm your payment with Stripe…' }}
          </p>
        </div>
      </div>

      <div v-if="pending" class="card p-10 text-center">
        <div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600 mb-4" />
        <p class="text-sm text-neutral-500">Loading your account…</p>
      </div>

      <div v-else-if="error" class="card p-8 text-center">
        <p class="text-neutral-700 mb-4">Failed to load account data.</p>
        <button class="btn-secondary text-sm" @click="refresh()">Retry</button>
      </div>

      <template v-else-if="data">
        <div v-if="data.entitlement.plan === 'trial'" class="card p-8 mb-6">
          <div class="flex items-start gap-4 mb-5">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-2xl">🎁</div>
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-bold text-primary-600 uppercase tracking-widest">Free Trial Active</span>
                <span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">✓ Active</span>
              </div>
              <h2 class="text-xl font-bold text-neutral-900">{{ daysRemaining(data.entitlement.trialEndsAt) }} days remaining</h2>
              <p class="text-sm text-neutral-500">Trial ends: {{ formatDate(data.entitlement.trialEndsAt) }}</p>
            </div>
          </div>
          <div v-if="billingError" class="mb-4 text-sm text-red-600 bg-red-50 rounded-lg p-3">{{ billingError }}</div>
          <div class="flex flex-col sm:flex-row gap-3">
            <button class="btn-primary" :disabled="!!billingLoading" @click="subscribe('yearly')">{{ billingLoading === 'yearly' ? 'Loading…' : 'Upgrade Annual (€39.99/yr)' }}</button>
            <button class="btn-secondary" :disabled="!!billingLoading" @click="subscribe('monthly')">{{ billingLoading === 'monthly' ? 'Loading…' : 'Upgrade Monthly (€4.99/mo)' }}</button>
          </div>
        </div>

        <div v-else-if="data.entitlement.plan === 'premium'" class="card p-8 mb-6">
          <div class="flex items-start gap-4 mb-5">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-2xl">🌟</div>
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-bold text-primary-600 uppercase tracking-widest">CalmEar Premium</span>
                <span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">✓ Active</span>
              </div>
              <h2 class="text-xl font-bold text-neutral-900">Premium subscription</h2>
              <p class="text-sm text-neutral-500">Next billing: {{ formatDate(data.entitlement.subscriptionEndsAt) }}</p>
            </div>
          </div>
          <div v-if="billingError" class="mb-4 text-sm text-red-600 bg-red-50 rounded-lg p-3">{{ billingError }}</div>
          <button class="btn-secondary" :disabled="billingLoading === 'portal'" @click="manageSubscription">{{ billingLoading === 'portal' ? 'Loading…' : 'Manage Subscription' }}</button>
        </div>


        <div v-else class="card p-8 mb-6 border-amber-200 bg-amber-50">
          <div class="flex items-start gap-4 mb-5">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-2xl">⏱️</div>
            <div>
              <div class="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Trial Ended</div>
              <h2 class="text-xl font-bold text-neutral-900">Your free trial has ended.</h2>
              <p class="text-sm text-neutral-700">Subscribe to continue using CalmEar Premium.</p>
            </div>
          </div>
          <div v-if="billingError" class="mb-4 text-sm text-red-600 bg-red-50 rounded-lg p-3">{{ billingError }}</div>
          <div class="flex flex-col sm:flex-row gap-3">
            <button class="btn-primary" :disabled="!!billingLoading" @click="subscribe('yearly')">{{ billingLoading === 'yearly' ? 'Loading…' : 'Subscribe Annual (€39.99/yr)' }}</button>
            <button class="btn-secondary" :disabled="!!billingLoading" @click="subscribe('monthly')">{{ billingLoading === 'monthly' ? 'Loading…' : 'Subscribe Monthly (€4.99/mo)' }}</button>
          </div>
        </div>

        <div class="card p-6 text-sm text-neutral-600 space-y-2">
          <div class="flex gap-2"><span class="font-medium text-neutral-800">Email:</span><span>{{ data.user.email ?? '—' }}</span></div>
          <div class="flex gap-2"><span class="font-medium text-neutral-800">Account ID:</span><code class="text-xs text-neutral-500">{{ data.user.id }}</code></div>
        </div>

      </template>
    </div>
  </div>
</template>

