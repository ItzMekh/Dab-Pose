import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// Lazy init: Next.js 16's "collecting page data" build phase evaluates
// route module exports without DATABASE_URL bound (it is a server-side
// runtime env, not a build-time env). Instantiating the Neon client at
// module evaluation throws "No database connection string was provided
// to `neon()`" and fails the build for every route that imports `db`.
//
// We defer the connection until the first query and proxy access so all
// existing call sites (`db.select(...)`, `db.insert(...)`, …) keep
// working unchanged.

type Db = ReturnType<typeof drizzle<typeof schema>>

let _db: Db | null = null

function getDb(): Db {
  if (_db) return _db
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
        'This must be defined in the Vercel project env or .env.local.',
    )
  }
  _db = drizzle(neon(url), { schema })
  return _db
}

export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver)
  },
}) as Db
