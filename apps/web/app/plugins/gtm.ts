/**
 * Google Tag Manager, on every page, when NUXT_PUBLIC_GTM_ID is set.
 *
 * The snippet is rendered into the server HTML (head script + body noscript),
 * as Google recommends, so GTM starts before hydration. Tags (e.g. the Reddit
 * Pixel) are configured in the GTM container, not here. Events are pushed to
 * the dataLayer with trackEvent() (app/utils/analytics.ts).
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
    script: [{
      key: 'gtm',
      tagPriority: 'high',
      innerHTML: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`,
    }],
    noscript: [{
      key: 'gtm-noscript',
      tagPosition: 'bodyOpen',
      innerHTML: `<iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
    }],
  })
})
