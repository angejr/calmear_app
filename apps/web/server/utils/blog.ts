/**
 * server/utils/blog.ts
 *
 * Blog posts are Markdown files in content/blog/, bundled with the server as
 * the "blog" server asset (nuxt.config.ts, nitro.serverAssets). The file name
 * is the URL: content/blog/misophonia-headphones.md -> /blog/misophonia-headphones
 *
 * Each file starts with a front matter block:
 *
 *   ---
 *   title: Headphones for misophonia
 *   description: One or two sentences shown in Google and on the blog page.
 *   date: 2026-11-10
 *   updated: 2026-12-01     (optional)
 *   author: Ange Ndoudi     (optional, this is the default)
 *   draft: true             (optional: visible in dev only)
 *   ---
 *
 * Files starting with "_" (e.g. _template.md) are ignored.
 */
import { marked } from 'marked'

export interface BlogPostMeta {
  slug: string
  title: string
  description: string
  date: string
  updated: string | null
  author: string
  draft: boolean
  readingMinutes: number
}

export interface BlogPost extends BlogPostMeta {
  html: string
}

const DEFAULT_AUTHOR = 'Ange Ndoudi'
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const WORDS_PER_MINUTE = 220

/**
 * Splits a file into its front matter (simple `key: value` lines; values may
 * be quoted) and its Markdown body. Pure.
 */
export function parseFrontMatter(source: string): { data: Record<string, string | boolean>, body: string } {
  // A byte order mark (U+FEFF) may precede the front matter in files saved on Windows
  const text = source.charCodeAt(0) === 0xFEFF ? source.slice(1) : source
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  if (!match) return { data: {}, body: text }
  const data: Record<string, string | boolean> = {}
  for (const line of match[1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (!kv) continue
    let value = kv[2]!.trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) value = value.slice(1, -1)
    data[kv[1]!] = value === 'true' ? true : value === 'false' ? false : value
  }
  return { data, body: match[2]! }
}

/**
 * Builds a post from a file name and its content. Throws with a readable
 * message when the front matter is incomplete, so a broken post fails loudly
 * in dev instead of rendering half empty. Pure.
 */
export function buildPost(fileName: string, source: string): BlogPost {
  const slug = fileName.replace(/\.md$/, '')
  if (!SLUG_RE.test(slug)) throw new Error(`Blog post "${fileName}": the file name must be lowercase words separated by hyphens.`)

  const parsed = parseFrontMatter(source)
  const data = parsed.data
  // Writing notes in <!-- comments --> are never published, not even in the page source
  const body = parsed.body.replace(/<!--[\s\S]*?-->/g, '')
  const text = (key: string) => (typeof data[key] === 'string' ? (data[key] as string) : '')
  for (const key of ['title', 'description', 'date']) {
    if (!text(key)) throw new Error(`Blog post "${fileName}": missing "${key}" in the front matter.`)
  }
  for (const key of ['date', 'updated']) {
    if (text(key) && !DATE_RE.test(text(key))) throw new Error(`Blog post "${fileName}": "${key}" must be written YYYY-MM-DD.`)
  }

  const words = body.replace(/[#>*_`[\]()!-]/g, ' ').split(/\s+/).filter(Boolean).length
  return {
    slug,
    title: text('title'),
    description: text('description'),
    date: text('date'),
    updated: text('updated') || null,
    author: text('author') || DEFAULT_AUTHOR,
    draft: data.draft === true,
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    html: marked.parse(body, { async: false, gfm: true }),
  }
}

/** Newest first; drafts only when `includeDrafts`. Pure. */
export function listPosts(posts: BlogPost[], includeDrafts: boolean): BlogPost[] {
  return posts
    .filter(p => includeDrafts || !p.draft)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)))
}

/**
 * Turns links to blog posts that are not visible (drafts, missing files)
 * into plain text, so posts can be published one at a time without broken
 * links. Pure.
 */
export function unlinkHiddenPosts(html: string, visibleSlugs: Set<string>): string {
  return html.replace(/<a href="\/blog\/([a-z0-9-]+)\/?"[^>]*>([\s\S]*?)<\/a>/g, (link, slug: string, text: string) =>
    visibleSlugs.has(slug) ? link : text)
}

export function toMeta({ html: _html, ...meta }: BlogPost): BlogPostMeta {
  return meta
}

let _cache: BlogPost[] | null = null

/** Every post in content/blog (read once in production, on each call in dev). */
export async function loadPosts(): Promise<BlogPost[]> {
  if (_cache && !import.meta.dev) return _cache
  const storage = useStorage('assets:blog')
  const keys = (await storage.getKeys()).filter(k => k.endsWith('.md') && !k.split(':').pop()!.startsWith('_'))
  const posts: BlogPost[] = []
  for (const key of keys) {
    const raw = await storage.getItemRaw(key)
    const source = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as Uint8Array)
    posts.push(buildPost(key.split(':').pop()!, source))
  }
  _cache = posts
  return posts
}

/** Published posts, plus drafts in dev. */
export async function getVisiblePosts(): Promise<BlogPost[]> {
  const posts = listPosts(await loadPosts(), import.meta.dev)
  const visible = new Set(posts.map(p => p.slug))
  return posts.map(p => ({ ...p, html: unlinkHiddenPosts(p.html, visible) }))
}
