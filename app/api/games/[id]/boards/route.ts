import { NextRequest, NextResponse } from 'next/server'
import { pool } from '../../../../lib/db'
import { isValidMineLayout } from '../../../../lib/game-logic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{id: string}> }) {
  const { id } = await params
  const { rows } = await pool.query('SELECT * FROM boards WHERE game_id = $1', [id])
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{id: string}> }) {
  const { id } = await params
  const playerId = req.headers.get('X-Player-Id')
  if (!playerId) return NextResponse.json({ error: 'No player ID' }, { status: 401 })

  const { mine_positions } = await req.json()

  // SECURITY: don't trust a client-submitted mine layout as-is — it's later
  // used verbatim to decide whether the *opponent's* clicks hit a mine, so an
  // out-of-spec layout (e.g. every cell mined) would let the submitter force
  // the opponent to lose on their first move. See isValidMineLayout.
  const { rows: gameRows } = await pool.query('SELECT board_size FROM games WHERE id = $1', [id])
  const boardSize: number = gameRows[0]?.board_size ?? 10
  if (!isValidMineLayout(mine_positions, boardSize)) {
    return NextResponse.json({ error: 'Invalid mine layout' }, { status: 400 })
  }

  const { rows } = await pool.query(
    `INSERT INTO boards (game_id, owner_id, mine_positions, reveal_state)
     VALUES ($1, $2, $3, '[]') ON CONFLICT DO NOTHING RETURNING *`,
    [id, playerId, JSON.stringify(mine_positions)]
  )

  // Check if both boards are submitted → start game
  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*) FROM boards WHERE game_id = $1', [id]
  )
  if (parseInt(countRows[0].count) >= 2) {
    await pool.query(`UPDATE games SET status = 'playing'::game_status, last_ping = now() WHERE id = $1`, [id])
  }

  return NextResponse.json(rows[0] ?? {})
}
