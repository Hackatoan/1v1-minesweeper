import { Pool } from 'pg'

const globalForPg = globalThis as unknown as { _pgPool: Pool | undefined }

export const pool = globalForPg._pgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
})

if (process.env.NODE_ENV !== 'production') globalForPg._pgPool = pool

// Periodically clean up inactive games (no pg_cron needed)
pool.query(`DELETE FROM games WHERE last_ping < NOW() - INTERVAL '10 minutes' AND status IN ('waiting', 'finished')`).catch(() => {})
