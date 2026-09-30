import { pool } from './db'

// Nickname-based leaderboard, keyed on (game, player). Shares the games-db
// `leaderboards` table with the other Hackatoa games.
export const GAME = process.env.GAME_ID || '1v1ms'

export function cleanName(n: unknown): string {
  if (typeof n !== 'string') return ''
  return n.trim().replace(/\s+/g, ' ').slice(0, 24)
}

type Outcome = 'win' | 'loss' | 'draw'

// Record a single finished round. If `uid` is given (the player was signed
// in when the match ended), the row's `player` key is the Firebase uid
// itself (not the typed nickname/display name) -- (game, player) is this
// table's primary key, and keying signed-in rows off a human-typed display
// name risks colliding with some other anonymous player's identical
// nickname. The uid is effectively unguessable and never collides.
// `display_name` carries what's actually shown; anonymous rows leave it
// null and fall back to `player`. Ported from tic-tac-toe-online's db.js.
async function recordResult(player: string, outcome: Outcome, uid: string | null = null): Promise<void> {
  const name = cleanName(player)
  if (!name) return
  const wins = outcome === 'win' ? 1 : 0
  const losses = outcome === 'loss' ? 1 : 0
  const draws = outcome === 'draw' ? 1 : 0
  const key = uid || name
  try {
    await pool.query(
      `INSERT INTO leaderboards (game, player, display_name, wins, losses, draws, games_played, updated_at, firebase_uid)
       VALUES ($1, $2, $3, $4, $5, $6, 1, now(), $7)
       ON CONFLICT (game, player) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         wins         = leaderboards.wins   + EXCLUDED.wins,
         losses       = leaderboards.losses + EXCLUDED.losses,
         draws        = leaderboards.draws  + EXCLUDED.draws,
         games_played = leaderboards.games_played + 1,
         updated_at   = now()`,
      [GAME, key, uid ? name : null, wins, losses, draws, uid]
    )
  } catch (err) {
    console.error('[leaderboard] recordResult failed:', (err as Error).message)
  }
}

// Record a finished match. winnerName === null means a draw. uidA/uidB are
// the Firebase uid for each player if they were signed in (null otherwise).
export async function recordMatch(
  nameA: string,
  nameB: string,
  winnerName: string | null,
  uidA: string | null = null,
  uidB: string | null = null
): Promise<void> {
  const a = cleanName(nameA)
  const b = cleanName(nameB)
  if (!a || !b) return
  if (winnerName === null) {
    await Promise.all([recordResult(a, 'draw', uidA), recordResult(b, 'draw', uidB)])
  } else {
    const w = cleanName(winnerName)
    const aIsWinner = w === a
    const [winnerUid, loserUid] = aIsWinner ? [uidA, uidB] : [uidB, uidA]
    const loser = aIsWinner ? b : a
    await Promise.all([recordResult(w, 'win', winnerUid), recordResult(loser, 'loss', loserUid)])
  }
}

// Merge a previously-accumulated anonymous nickname row into a signed-in
// account's row (or create the account row if this is its first match).
// Used by the "was one of these your nickname?" claim flow after sign-in.
export async function claimNickname(
  nickname: string,
  uid: string,
  displayName: string
): Promise<{ ok: boolean; reason?: string }> {
  const name = cleanName(nickname)
  if (!name || !uid) return { ok: false, reason: 'invalid input' }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: oldRows } = await client.query(
      `SELECT wins, losses, draws, games_played FROM leaderboards
       WHERE game = $1 AND player = $2 AND firebase_uid IS NULL FOR UPDATE`,
      [GAME, name]
    )
    if (oldRows.length === 0) {
      await client.query('ROLLBACK')
      return { ok: false, reason: 'no unclaimed row for that nickname' }
    }
    const old = oldRows[0]
    await client.query(
      `INSERT INTO leaderboards (game, player, display_name, wins, losses, draws, games_played, updated_at, firebase_uid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8)
       ON CONFLICT (game, player) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         wins         = leaderboards.wins   + EXCLUDED.wins,
         losses       = leaderboards.losses + EXCLUDED.losses,
         draws        = leaderboards.draws  + EXCLUDED.draws,
         games_played = leaderboards.games_played + EXCLUDED.games_played,
         updated_at   = now()`,
      [GAME, uid, cleanName(displayName) || name, old.wins, old.losses, old.draws, old.games_played, uid]
    )
    await client.query('DELETE FROM leaderboards WHERE game = $1 AND player = $2 AND firebase_uid IS NULL', [GAME, name])
    await client.query('COMMIT')
    return { ok: true }
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[leaderboard] claimNickname failed:', (err as Error).message)
    return { ok: false, reason: 'internal error' }
  } finally {
    client.release()
  }
}

export async function getLeaderboard(limit = 20) {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(display_name, player) AS player, wins, losses, draws, games_played
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
