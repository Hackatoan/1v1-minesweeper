import { NextRequest, NextResponse } from 'next/server'
import { pool } from '../../../../lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{id: string}> }) {
  const { id } = await params
  const { rows } = await pool.query('SELECT * FROM moves WHERE game_id = $1 ORDER BY timestamp ASC', [id])
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{id: string}> }) {
  const { id } = await params
  const playerId = req.headers.get('X-Player-Id')
  if (!playerId) return NextResponse.json({ error: 'No player ID' }, { status: 401 })

  const { moves } = await req.json()
  if (!moves?.length) return NextResponse.json([])

  const values: any[] = []
  const rows_sql = moves.map((_: any, i: number) => {
    const base = i * 4
    values.push(id, playerId, JSON.stringify(moves[i].cell), moves[i].hit_mine ?? false)
    return `($${base+1}, $${base+2}, $${base+3}, $${base+4})`
  }).join(', ')

  const { rows } = await pool.query(
    `INSERT INTO moves (game_id, player_id, cell, hit_mine) VALUES ${rows_sql} ON CONFLICT DO NOTHING RETURNING *`,
    values
  )

  // Update last_ping and presence
  await pool.query(
    `UPDATE games SET last_ping = now(), player_pings = player_pings || jsonb_build_object($1::text, now()::text) WHERE id = $2`,
    [playerId, id]
  )

  return NextResponse.json(rows)
}
