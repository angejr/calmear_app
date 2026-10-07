/**
 * Google Tag Manager, on every page, when NUXT_PUBLIC_GTM_ID is set.
 *
 * gtm.js (and everything the container loads: Google tag, Reddit Pixel,
 * Clarity...) is injected once the page has hydrated and the browser is idle
 * (onNuxtReady), so these scripts do not compete with the page's own content
 * while it loads. Events pushed before that (trackEvent) wait in
 * window.dataLayer and are processed when GTM starts. The <noscript> fallback
 * is rendered by the server. Tags are configured in the GTM container.
 */
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/

export default defineNuxtPlugin(() => {
  const id = useRuntimeConfig().public.gtmId as string
  if (!id) return
  if (!GTM_ID_PATTERN.test(id)) {
    console.warn(`[gtm] Ignoring invalid NUXT_PUBLIC_GTM_ID "${id}" (expected GTM-XXXXXXX).`)
    return
  }

  useHead({
    noscript: [{
      key: 'gtm-noscript',
      tagPosition: 'bodyOpen',
      innerHTML: `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
    }],
  })

  if (import.meta.server) return

  const w = window as Window & { dataLayer?: Record<string, unknown>[] }
  w.dataLayer = w.dataLayer || []

  onNuxtReady(() => {
    w.dataLayer!.push({ 'gtm.start': Date.now(), 'event': 'gtm.js' })
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtm.js?id=${id}`
    document.head.appendChild(script)
  })
})
