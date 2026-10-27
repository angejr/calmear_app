import { isRateLimited, parseFeedback, saveFeedback } from '../services/feedback'

/**
 * POST /api/feedback
 *
 * Stores an answer from the /feedback or /uninstalled form.
 *
 * Authentication: none (people who uninstalled are usually signed out).
 * Abuse protection: honeypot field, input limits and a per-address rate limit.
 */
export default defineEventHandler(async (event) => {
  // Fly.io's proxy sets Fly-Client-IP; X-Forwarded-For could be forged by the client.
  const ip = getRequestHeader(event, 'fly-client-ip') ?? getRequestIP(event) ?? 'unknown'
  if (isRateLimited(ip)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many messages. Please try again later.' })
  }

  const parsed = parseFeedback(await readBody(event))
  if (parsed.ok === 'spam') return { ok: true }
  if (!parsed.ok) throw createError({ statusCode: 400, statusMessage: parsed.error })

  await saveFeedback(parsed.value)
  return { ok: true }
})
