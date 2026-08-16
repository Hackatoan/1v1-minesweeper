import { NextRequest, NextResponse } from 'next/server'
import { pool } from '../../../lib/db'
import { cleanName, recordMatch } from '../../../lib/leaderboard'

export async function GET(_req: NextRequest, { params }: { params: Promise<{id: string}> }) {
  const { id } = await params
  const { rows } = await pool.query('SELECT * FROM games WHERE id = $1', [id])
  if (!rows[0]) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(rows[0])
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{id: string}> }) {
  const { id } = await params
  const playerId = req.headers.get('X-Player-Id')
  const playerName = cleanName(req.headers.get('X-Player-Name'))
  const body = await req.json()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Lock the row so a simultaneous finish from both players can't double-record.
    const cur = await client.query('SELECT * FROM games WHERE id = $1 FOR UPDATE', [id])
    if (!cur.rows[0]) {
      await client.query('ROLLBACK')
      return NextResponse.json(null, { status: 404 })
    }
    const before = cur.rows[0]

    // Build dynamic update from the request body.
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

    // Capture the acting player's nickname onto the correct slot. Handles the
    // join case (player2_id is being set in this same request) too.
    const effP1 = body.player1_id ?? before.player1_id
    const effP2 = body.player2_id ?? before.player2_id
    if (playerName && playerId && playerId === effP1) {
      values.push(playerName)
      setClauses.push(`player1_name = $${values.length}`)
    } else if (playerName && playerId && playerId === effP2) {
      values.push(playerName)
      setClauses.push(`player2_name = $${values.length}`)
    }

    // Always update last_ping on any game update.
    setClauses.push(`last_ping = now()`)

    if (playerId) {
      values.push(playerId)
      setClauses.push(`player_pings = player_pings || jsonb_build_object($${values.length}::text, now()::text)`)
    }

    values.push(id)
    const upd = await client.query(
      `UPDATE games SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    )
    await client.query('COMMIT')

    const after = upd.rows[0]

    // Record to the leaderboard only on the transition into 'finished'.
    if (before.status !== 'finished' && after.status === 'finished' && after.winner_id) {
      const winnerName = after.winner_id === after.player1_id ? after.player1_name : after.player2_name
      recordMatch(after.player1_name, after.player2_name, winnerName ?? null)
    }

    return NextResponse.json(after)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
