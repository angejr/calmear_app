// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  future: {
    compatibilityVersion: 4,
  },
  modules: ['@clerk/nuxt', '@nuxtjs/tailwindcss', '@nuxt/eslint'],
  clerk: {
    skipServerMiddleware: false,
    afterSignInUrl: '/dashboard',
    afterSignUpUrl: '/dashboard',
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    // Server-only secrets — never exposed to browser
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    stripeMonthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_ID || '',
    stripeYearlyPriceId: process.env.STRIPE_YEARLY_PRICE_ID || '',
    databaseUrl: process.env.DATABASE_URL || '',
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
