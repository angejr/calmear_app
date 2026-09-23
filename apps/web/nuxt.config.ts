// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  future: {
    compatibilityVersion: 4,
  },
  modules: ['@clerk/nuxt', '@nuxtjs/tailwindcss', '@nuxt/eslint'],
  clerk: {
    skipServerMiddleware: false,
    signInFallbackRedirectUrl: '/dashboard',
    signUpFallbackRedirectUrl: '/dashboard',
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    // Server-only secrets — never exposed to browser.
    // Each key is overridable at runtime via its NUXT_ environment variable
    // (e.g. stripeSecretKey <- NUXT_STRIPE_SECRET_KEY) — same names in dev (.env)
    // and production (Fly.io secrets).
    stripeSecretKey: process.env.NUXT_STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.NUXT_STRIPE_WEBHOOK_SECRET || '',
    stripeMonthlyPriceId: process.env.NUXT_STRIPE_MONTHLY_PRICE_ID || '',
    stripeYearlyPriceId: process.env.NUXT_STRIPE_YEARLY_PRICE_ID || '',
    databaseUrl: process.env.NUXT_DATABASE_URL || '',
    // Public — safe for browser
    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  tailwindcss: {
    configPath: '~/tailwind.config.ts',
  },
})
