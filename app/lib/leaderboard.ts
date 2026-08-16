import { pool } from './db'

// Nickname-based leaderboard, keyed on (game, player). Shares the games-db
// `leaderboards` table with the other Hackatoa games.
export const GAME = process.env.GAME_ID || '1v1ms'

export function cleanName(n: unknown): string {
  if (typeof n !== 'string') return ''
  return n.trim().replace(/\s+/g, ' ').slice(0, 24)
}

type Outcome = 'win' | 'loss' | 'draw'

async function recordResult(player: string, outcome: Outcome): Promise<void> {
  const name = cleanName(player)
  if (!name) return
  const wins = outcome === 'win' ? 1 : 0
  const losses = outcome === 'loss' ? 1 : 0
  const draws = outcome === 'draw' ? 1 : 0
  try {
    await pool.query(
      `INSERT INTO leaderboards (game, player, wins, losses, draws, games_played, updated_at)
       VALUES ($1, $2, $3, $4, $5, 1, now())
       ON CONFLICT (game, player) DO UPDATE SET
         wins         = leaderboards.wins   + EXCLUDED.wins,
         losses       = leaderboards.losses + EXCLUDED.losses,
         draws        = leaderboards.draws  + EXCLUDED.draws,
         games_played = leaderboards.games_played + 1,
         updated_at   = now()`,
      [GAME, name, wins, losses, draws]
    )
  } catch (err) {
    console.error('[leaderboard] recordResult failed:', (err as Error).message)
  }
}

// Record a finished match. winnerName === null means a draw.
export async function recordMatch(nameA: string, nameB: string, winnerName: string | null): Promise<void> {
  const a = cleanName(nameA)
  const b = cleanName(nameB)
  if (!a || !b) return
  if (winnerName === null) {
    await Promise.all([recordResult(a, 'draw'), recordResult(b, 'draw')])
  } else {
    const w = cleanName(winnerName)
    const loser = w === a ? b : a
    await Promise.all([recordResult(w, 'win'), recordResult(loser, 'loss')])
  }
}

export async function getLeaderboard(limit = 20) {
  try {
    const { rows } = await pool.query(
      `SELECT player, wins, losses, draws, games_played
         FROM leaderboards
        WHERE game = $1
        ORDER BY wins DESC, games_played ASC, updated_at ASC
        LIMIT $2`,
      [GAME, limit]
    )
    return rows
  } catch (err) {
    console.error('[leaderboard] getLeaderboard failed:', (err as Error).message)
    return []
  }
}
