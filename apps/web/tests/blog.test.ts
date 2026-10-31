import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildPost, listPosts, parseFrontMatter, toMeta } from '../server/utils/blog'

const post = (fm: string, body = 'Hello **world**.') => `---\n${fm}\n---\n\n${body}\n`
const valid = 'title: "Headphones for misophonia: what helps"\ndescription: A short summary.\ndate: 2026-11-10'

describe('parseFrontMatter', () => {
  it('reads key: value lines, quoted values and booleans', () => {
    const { data, body } = parseFrontMatter(post(`${valid}\ndraft: true\nauthor: 'Ange Ndoudi'`))
    expect(data).toEqual({ title: 'Headphones for misophonia: what helps', description: 'A short summary.', date: '2026-11-10', draft: true, author: 'Ange Ndoudi' })
    expect(body.trim()).toBe('Hello **world**.')
  })

  it('handles Windows line endings and a byte order mark', () => {
    const { data } = parseFrontMatter(`${String.fromCharCode(0xFEFF)}---\r\ntitle: T\r\n---\r\nBody`)
    expect(data.title).toBe('T')
  })

  it('returns the whole file as body when there is no front matter', () => {
    expect(parseFrontMatter('# Just text')).toEqual({ data: {}, body: '# Just text' })
  })
})

describe('buildPost', () => {
  it('builds a post with defaults and renders Markdown', () => {
    const p = buildPost('misophonia-headphones.md', post(valid))
    expect(p).toMatchObject({ slug: 'misophonia-headphones', author: 'Ange Ndoudi', draft: false, updated: null, readingMinutes: 1 })
    expect(p.html).toContain('<strong>world</strong>')
  })

  it('estimates reading time from the body', () => {
    const p = buildPost('long-post.md', post(valid, 'word '.repeat(1100)))
    expect(p.readingMinutes).toBe(5)
  })

  it('rejects missing fields, bad dates and bad file names with a clear message', () => {
    expect(() => buildPost('a.md', post('title: T\ndate: 2026-11-10'))).toThrow('missing "description"')
    expect(() => buildPost('a.md', post(`${valid}\nupdated: 10/12/2026`))).toThrow('"updated" must be written YYYY-MM-DD')
    expect(() => buildPost('Misophonia Headphones.md', post(valid))).toThrow('lowercase words separated by hyphens')
  })
})

describe('listPosts', () => {
  const a = buildPost('older.md', post(valid.replace('2026-11-10', '2026-11-01')))
  const b = buildPost('newer.md', post(valid))
  const d = buildPost('draft-post.md', post(`${valid.replace('2026-11-10', '2026-12-01')}\ndraft: true`))

  it('sorts newest first and hides drafts unless asked', () => {
    expect(listPosts([a, d, b], false).map(p => p.slug)).toEqual(['newer', 'older'])
    expect(listPosts([a, d, b], true).map(p => p.slug)).toEqual(['draft-post', 'newer', 'older'])
  })

  it('drops the HTML from the list metadata', () => {
    expect(toMeta(a)).not.toHaveProperty('html')
  })
})

describe('content/blog/_template.md', () => {
  it('is a valid post, so copying it gives a working starting point', () => {
    const source = readFileSync(new URL('../content/blog/_template.md', import.meta.url), 'utf8')
    expect(buildPost('template.md', source).draft).toBe(true)
  })
})
