import { NextRequest, NextResponse } from 'next/server'
import { pool } from '../../../../lib/db'
import { isValidRevealBatch } from '../../../../lib/game-logic'

export async function GET(req: NextRequest, { params }: { params: Promise<{id: string}> }) {
  const { id } = await params
  // Optional cursor: only return moves recorded after this timestamp. Lets
  // the client's poll loop fetch just the delta instead of re-transferring
  // (and re-diffing) the whole move history every 1.5s for the life of a match.
  const since = req.nextUrl.searchParams.get('since')
  const { rows } = since
    ? await pool.query('SELECT * FROM moves WHERE game_id = $1 AND timestamp > $2 ORDER BY timestamp ASC', [id, since])
    : await pool.query('SELECT * FROM moves WHERE game_id = $1 ORDER BY timestamp ASC', [id])
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{id: string}> }) {
  const { id } = await params
  const playerId = req.headers.get('X-Player-Id')
  if (!playerId) return NextResponse.json({ error: 'No player ID' }, { status: 401 })

  const { moves } = await req.json()
  if (!moves?.length) return NextResponse.json([])

  // SECURITY: hit_mine must never be trusted from the client — otherwise a
  // player can simply always report `hit_mine: false` and win every match
  // without ever losing. Recompute it server-side from the opponent's
  // stored mine layout instead of using the client-supplied value.
  const { rows: oppBoardRows } = await pool.query(
    'SELECT mine_positions FROM boards WHERE game_id = $1 AND owner_id != $2',
    [id, playerId]
  )
  const minePositions: { r: number; c: number }[] = oppBoardRows[0]?.mine_positions ?? []
  const isMine = (r: number, c: number) => minePositions.some((m) => m.r === r && m.c === c)

  const cells = (moves as { cell?: { r: number; c: number } }[]).map((mv) => mv?.cell ?? { r: -1, c: -1 })
  const anyMineHit = cells.some((c) => isMine(c.r, c.c))

  // SECURITY: a single POST must correspond to exactly one legitimate dig —
  // either one mine hit, or the flood-fill cascade that one safe click
  // produces. Without this, a client can submit an arbitrary batch of safe
  // cells (trivial to compute once you know the mine layout you're digging
  // into, which every player legitimately has) and reveal the whole board —
  // and therefore win — in a single request instead of actually playing.
  if (anyMineHit) {
    if (cells.length !== 1) {
      return NextResponse.json({ error: 'Invalid move batch' }, { status: 400 })
    }
  } else {
    const { rows: gameRows } = await pool.query('SELECT board_size FROM games WHERE id = $1', [id])
    const boardSize: number = gameRows[0]?.board_size ?? 10
    const { rows: existingMoveRows } = await pool.query(
      'SELECT cell FROM moves WHERE game_id = $1 AND player_id = $2',
      [id, playerId]
    )
    const alreadyRevealed = new Set<string>(
      existingMoveRows.map((m) => `${m.cell.r},${m.cell.c}`)
    )
    if (!isValidRevealBatch(cells, minePositions, boardSize, alreadyRevealed)) {
      return NextResponse.json({ error: 'Invalid move batch' }, { status: 400 })
    }
  }

  const values: unknown[] = []
  const rows_sql = cells.map((cell, i) => {
    const base = i * 4
    const hitMine = isMine(cell.r, cell.c)
    values.push(id, playerId, JSON.stringify(cell), hitMine)
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
