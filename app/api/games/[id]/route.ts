import { NextRequest, NextResponse } from 'next/server'
import { pool } from '../../../lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{id: string}> }) {
  const { id } = await params
  const { rows } = await pool.query('SELECT * FROM games WHERE id = $1', [id])
  if (!rows[0]) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(rows[0])
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{id: string}> }) {
  const { id } = await params
  const playerId = req.headers.get('X-Player-Id')
  const body = await req.json()

  // Build dynamic update
  const setClauses: string[] = []
  const values: any[] = []

  for (const [key, val] of Object.entries(body)) {
    values.push(val)
    if (key === 'status') {
      setClauses.push(`${key} = $${values.length}::game_status`)
    } else {
      setClauses.push(`${key} = $${values.length}`)
    }
  }

  // Always update last_ping on any game update
  setClauses.push(`last_ping = now()`)

  if (playerId) {
    setClauses.push(`player_pings = player_pings || jsonb_build_object($${values.length + 1}::text, now()::text)`)
    values.push(playerId)
  }

  values.push(id)
  const { rows } = await pool.query(
    `UPDATE games SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  )
  if (!rows[0]) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(rows[0])
}
