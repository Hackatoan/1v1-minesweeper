import { Pool } from 'pg'

const globalForPg = globalThis as unknown as { _pgPool: Pool | undefined }

export const pool = globalForPg._pgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
})

if (process.env.NODE_ENV !== 'production') globalForPg._pgPool = pool

// Periodically clean up inactive games (no pg_cron needed)
pool.query(`DELETE FROM games WHERE last_ping < NOW() - INTERVAL '10 minutes' AND status IN ('waiting', 'finished')`).catch(() => {})

// Rush mode schema, applied idempotently on boot (same no-migration-runner
// approach as the cleanup above). Routes that touch the new columns await
// dbReady so a cold start can't query them before they exist. Never rejects.
export const dbReady: Promise<void> = (async () => {
  try {
    await pool.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'classic'`)
    await pool.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`)
    await pool.query(`ALTER TABLE moves ADD COLUMN IF NOT EXISTS board_idx INT NOT NULL DEFAULT 0`)
    await pool.query(`CREATE TABLE IF NOT EXISTS rush_boards (
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL,
      idx INT NOT NULL,
      density REAL NOT NULL,
      mine_positions JSONB NOT NULL,
      PRIMARY KEY (game_id, player_id, idx)
    )`)
  } catch {
    // No DB reachable (e.g. during `next build`) — requests will surface it.
  }
})()
