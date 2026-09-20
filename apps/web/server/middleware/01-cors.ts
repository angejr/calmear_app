/**
 * server/middleware/01-cors.ts
 *
 * CORS middleware for the CalmEar web app.
 *
 * The Chrome extension runs from a chrome-extension:// origin and calls the
 * public API endpoints (activate, entitlement, session). Chrome extension
 * fetches with host_permissions normally bypass CORS, but we set explicit
 * headers so OPTIONS preflights and any stricter browser behaviour are handled
 * correctly. In development we also allow localhost origins.
 */
export default defineEventHandler((event) => {
  const origin = getRequestHeader(event, 'origin') || ''

  const isExtension = origin.startsWith('chrome-extension://')
  const isLocalhost = origin.startsWith('http://localhost:')

  if (isExtension || isLocalhost) {
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    })
  }

  if (event.method === 'OPTIONS') {
    event.node.res.statusCode = 204
    return ''
  }
})
