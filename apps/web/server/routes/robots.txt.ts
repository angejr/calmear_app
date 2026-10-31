/**
 * GET /robots.txt
 *
 * Lets search engines crawl the public site and points them to the sitemap.
 * API routes and signed-in pages are not worth crawling.
 */
export default defineEventHandler((event) => {
  const base = (useRuntimeConfig().public.appUrl as string).replace(/\/$/, '')
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=86400')
  return `User-agent: *
Disallow: /api/
Disallow: /dashboard
Disallow: /extension/

Sitemap: ${base}/sitemap.xml
`
})
