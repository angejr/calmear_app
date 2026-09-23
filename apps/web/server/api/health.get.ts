/**
 * GET /api/health
 *
 * Simple liveness/readiness probe used by Fly.io health checks.
 * Returns 200 without requiring authentication and does not touch the
 * database or any external service — it only proves the Nitro server is up.
 */
export default defineEventHandler(() => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  }
})
