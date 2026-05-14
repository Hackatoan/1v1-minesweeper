import { NextRequest, NextResponse } from 'next/server'
import { pool } from '../../lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const isPublic = searchParams.get('is_public')
  const boardSize = searchParams.get('board_size')
  const since = searchParams.get('since')

  let query = 'SELECT * FROM games WHERE 1=1'
  const params: any[] = []

  if (status) { params.push(status); query += ` AND status = $${params.length}::game_status` }
  if (isPublic) { params.push(isPublic === 'true'); query += ` AND is_public = $${params.length}` }
  if (boardSize) { params.push(parseInt(boardSize)); query += ` AND board_size = $${params.length}` }
  if (since) {
    const cutoff = new Date(Date.now() - parseInt(since)).toISOString()
    params.push(cutoff)
    query += ` AND last_ping >= $${params.length}`
  }
  query += ' ORDER BY created_at ASC LIMIT 20'

  const { rows } = await pool.query(query, params)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const playerId = req.headers.get('X-Player-Id')
  if (!playerId) return NextResponse.json({ error: 'No player ID' }, { status: 401 })

  const body = await req.json()
  const id = Math.random().toString(36).substring(2, 8).toUpperCase()
  const boardSize = body.board_size ?? 10
  const isPublic = body.is_public ?? false
  const player2Id = body.player2_id ?? null
  const status = body.status ?? 'waiting'

  const { rows } = await pool.query(
    `INSERT INTO games (id, player1_id, player2_id, status, board_size, is_public, player_pings)
     VALUES ($1, $2, $3, $4::game_status, $5, $6, $7) RETURNING *`,
    [id, playerId, player2Id, status, boardSize, isPublic, JSON.stringify({ [playerId]: new Date().toISOString() })]
  )
  return NextResponse.json(rows[0])
}
