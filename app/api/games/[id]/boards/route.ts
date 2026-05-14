import { NextRequest, NextResponse } from 'next/server'
import { pool } from '../../../../lib/db'

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
