import { getVisiblePosts } from '../../utils/blog'

/**
 * GET /api/blog/:slug
 *
 * One published post with its HTML, plus the next most recent posts to link to.
 *
 * Authentication: none
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const posts = await getVisiblePosts()
  const post = posts.find(p => p.slug === slug)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Post not found.' })

  const related = posts
    .filter(p => p.slug !== post.slug)
    .slice(0, 3)
    .map(({ slug, title, description }) => ({ slug, title, description }))
  return { post, related }
})
