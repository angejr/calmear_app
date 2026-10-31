import { getVisiblePosts } from '../utils/blog'

/**
 * GET /sitemap.xml
 *
 * Public pages and published blog posts, for search engines. Pages marked
 * noindex (/feedback, /uninstalled) and signed-in pages are left out.
 */
const STATIC_PAGES = ['/', '/pricing', '/download', '/blog', '/privacy']

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c]!)
}

export default defineEventHandler(async (event) => {
  const base = (useRuntimeConfig().public.appUrl as string).replace(/\/$/, '')
  const posts = (await getVisiblePosts()).filter(p => !p.draft)

  const urls = [
    ...STATIC_PAGES.map(path => ({ loc: `${base}${path}`, lastmod: null as string | null })),
    ...posts.map(p => ({ loc: `${base}/blog/${p.slug}`, lastmod: p.updated ?? p.date })),
  ]

  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`
})
