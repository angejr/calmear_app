import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../drizzle/schema'

let _db: ReturnType<typeof drizzle> | null = null

/**
 * Returns a singleton Drizzle ORM instance connected to Supabase PostgreSQL.
 *
 * Uses Supabase's transaction pooler (port 6543) which is compatible with
 * serverless/edge environments where persistent connections are not feasible.
 */
export function useDb() {
  if (_db) return _db

  const config = useRuntimeConfig()
  const url = config.databaseUrl

  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Add it to your .env file.',
    )
  }

  // max: 1 is important for serverless — we get a fresh connection per request
  // from the Supabase connection pooler, so we don't need a pool here.
  const client = postgres(url, { max: 1, prepare: false })
  _db = drizzle(client, { schema })
  return _db
}
