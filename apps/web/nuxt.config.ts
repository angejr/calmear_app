// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'
import { DEMO_MODEL_DEV_ROUTE, demoModelDevHandler } from './scripts/demo-model-dev-handler'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  future: {
    compatibilityVersion: 4,
  },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/png', href: '/icon.png' },
        { rel: 'apple-touch-icon', href: '/icon.png' },
      ],
    },
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
      // CalmEar model used by the landing-page demo (the extension's model.onnx).
      // Production: an external URL (bucket/CDN with CORS). Dev default: served
      // from the calmear_extension checkout by scripts/demo-model-dev-handler.ts.
      demoModelUrl: process.env.NUXT_PUBLIC_DEMO_MODEL_URL || DEMO_MODEL_DEV_ROUTE,
      // Google Tag Manager container (GTM-XXXXXXX). Empty: GTM is not loaded.
      gtmId: process.env.NUXT_PUBLIC_GTM_ID || '',
    },
  },
  devServerHandlers: [
    { route: DEMO_MODEL_DEV_ROUTE, handler: demoModelDevHandler(fileURLToPath(new URL('.', import.meta.url))) },
  ],
  vite: {
    resolve: {
      // The landing-page demo worker uses the same onnxruntime-web build as the
      // extension (lib/ort.min.js, here as ES module), which loads its WASM from
      // ort.env.wasm.wasmPaths (/demo/ort/) instead of bundling it.
      alias: [{ find: /^onnxruntime-web$/, replacement: fileURLToPath(new URL('./node_modules/onnxruntime-web/dist/ort.min.mjs', import.meta.url)) }],
    },
    // Dev only: pre-bundle it at startup instead of when the demo worker first
    // imports it (which makes Vite reload the page mid-demo).
    optimizeDeps: { include: ['onnxruntime-web'] },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  tailwindcss: {
    configPath: '~/tailwind.config.ts',
  },
})
