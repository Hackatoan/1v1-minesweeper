import { NextRequest, NextResponse } from 'next/server'
import { pool } from '../../../../lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{id: string}> }) {
  const { id } = await params
  const playerId = req.headers.get('X-Player-Id')
  if (!playerId) return NextResponse.json({}, { status: 401 })

  await pool.query(
    `UPDATE games SET last_ping = now(), player_pings = player_pings || jsonb_build_object($1::text, now()::text) WHERE id = $2`,
    [playerId, id]
  )
  return NextResponse.json({ ok: true })
}
