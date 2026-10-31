import { getVisiblePosts, toMeta } from '../../utils/blog'

/**
 * GET /api/blog
 *
 * Published posts, newest first, without their content.
 *
 * Authentication: none
 */
export default defineEventHandler(async () => {
  return (await getVisiblePosts()).map(toMeta)
})
