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

    // player1_id is never client-settable; player2_id can be, in the same
    // request that sets it (the join flow). Compute the effective pair once,
    // used both for the winner_id check below and the name-capture logic.
    const effP1 = before.player1_id
    const effP2 = body.player2_id ?? before.player2_id

    // Server-side validation of a self-reported winner_id (SECURITY: without
    // this, any client could PATCH an arbitrary winner_id with no relation
    // to what actually happened in the match). We don't have a full
    // authoritative replay of the match (no server-side board/board-reveal
    // engine — moves are recorded from client-computed flood fills), so this
    // is deliberately scoped to what we CAN verify from the moves table
    // recorded so far, rather than guessing at unvalidated game rules:
    //   1. winner_id must be one of this game's two actual participants.
    //   2. winner_id must not be a player who is on record as having hit a
    //      mine in this game (you can't have exploded and also won).
    //   3. winner_id must not be declared over an opponent who is on record
    //      as having already cleared the board (every non-mine cell safely
    //      revealed) — that opponent already won.
    // This blocks the direct "PATCH myself a win" cases. It intentionally
    // does NOT block a legitimate forfeit/disconnect win (winner_id set to
    // the non-acting player with no moves evidence either way) — there's no
    // server-tracked signal to distinguish that from e.g. an early win claim
    // before the board is fully cleared, and rejecting all unevidenced
    // transitions would break the real forfeit feature. Full outcome
    // validation would need a server-side authoritative board state; noted
    // as a follow-up rather than guessed at here.
    if (Object.prototype.hasOwnProperty.call(body, 'winner_id') && body.winner_id != null) {
      const winnerId = body.winner_id
      if (winnerId !== effP1 && winnerId !== effP2) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'winner_id must be a participant in this game' }, { status: 400 })
      }

      const loserId = winnerId === effP1 ? effP2 : effP1
      const { rows: moveRows } = await client.query(
        'SELECT player_id, cell, hit_mine FROM moves WHERE game_id = $1',
        [id]
      )

      const winnerExploded = moveRows.some((m) => m.player_id === winnerId && m.hit_mine)

      const boardSize = before.board_size
      const totalNonMines = boardSize * boardSize - Math.floor(boardSize * boardSize * 0.15)
      const loserSafeCells = new Set(
        moveRows
          .filter((m) => m.player_id === loserId && !m.hit_mine)
          .map((m) => `${m.cell.r},${m.cell.c}`)
      )
      const loserAlreadyCleared = loserId != null && loserSafeCells.size >= totalNonMines

      if (winnerExploded || loserAlreadyCleared) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'winner_id contradicts recorded game history' }, { status: 409 })
      }
    }

    // Build dynamic update from the request body. Only these fields are ever
    // sent by the client (see updateGame() call sites in app/) — restrict to
    // an explicit allowlist so an arbitrary request body can't inject
    // unexpected column names into the SQL (the values were already
    // parameterized, but the column names were not).
    const ALLOWED_FIELDS = new Set(['status', 'winner_id', 'player2_id', 'rematch_game_id'])
    const setClauses: string[] = []
    const values: unknown[] = []
    for (const [key, val] of Object.entries(body)) {
      if (!ALLOWED_FIELDS.has(key)) continue
      values.push(val)
      if (key === 'status') {
        setClauses.push(`${key} = $${values.length}::game_status`)
      } else {
        setClauses.push(`${key} = $${values.length}`)
      }
    }

    // Capture the acting player's nickname onto the correct slot. Handles the
    // join case (player2_id is being set in this same request) too.
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
