import { NextRequest, NextResponse } from 'next/server'
import { dbReady, pool } from '../../../../lib/db'
import { RUSH_BOARD_SIZE } from '../../../../lib/rush'
import {
    announceFinish, applyDig, buildView, ensureBoard, loadProgress, opponentOf, settleIfExpired,
    type Db,
} from '../../../../lib/rush-server'
import type { Game } from '../../../../lib/types'

type Ctx = { params: Promise<{ id: string }> }

// Current state for the calling player: own revealed cells + stats, opponent
// stats only. Also the lazy trigger for the time cap (both clients poll this).
async function snapshot(db: Db, game: Game, playerId: string) {
    const oppId = opponentOf(game, playerId)
    if (!oppId) return null
    const [me, opp] = await Promise.all([loadProgress(db, game.id, playerId), loadProgress(db, game.id, oppId)])
    if (game.status === 'playing' && !me.current && me.lives > 0) {
        await ensureBoard(db, game.id, playerId, me, opp)
        return buildView(game, await loadProgress(db, game.id, playerId), opp)
    }
    return buildView(game, me, opp)
}

async function loadRushGame(db: Db, id: string, playerId: string | null, lock: boolean) {
    const { rows } = await db.query(`SELECT * FROM games WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id])
    const game: Game | undefined = rows[0]
    if (!game) return { error: NextResponse.json(null, { status: 404 }) }
    if (game.mode !== 'rush') return { error: NextResponse.json({ error: 'Not a rush game' }, { status: 400 }) }
    if (!playerId || (playerId !== game.player1_id && playerId !== game.player2_id)) {
        return { error: NextResponse.json({ error: 'Not a participant' }, { status: 403 }) }
    }
    return { game }
}

export async function GET(req: NextRequest, { params }: Ctx) {
    await dbReady
    const { id } = await params
    const playerId = req.headers.get('X-Player-Id')

    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const loaded = await loadRushGame(client, id, playerId, true)
        if ('error' in loaded) { await client.query('ROLLBACK'); return loaded.error }
        let game = loaded.game
        const finished = await settleIfExpired(client, game)
        if (finished) game = finished
        const view = await snapshot(client, game, playerId!)
        await client.query('COMMIT')
        if (finished) await announceFinish(pool, finished)
        return NextResponse.json(view)
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
    } finally {
        client.release()
    }
}

export async function POST(req: NextRequest, { params }: Ctx) {
    await dbReady
    const { id } = await params
    const playerId = req.headers.get('X-Player-Id')

    const body = await req.json().catch(() => null)
    const r = body?.cell?.r
    const c = body?.cell?.c
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= RUSH_BOARD_SIZE || c >= RUSH_BOARD_SIZE) {
        return NextResponse.json({ error: 'Invalid cell' }, { status: 400 })
    }

    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        // The game-row lock serializes every mutation for the match, so two
        // fast clicks (or both players finishing at once) can't interleave.
        const loaded = await loadRushGame(client, id, playerId, true)
        if ('error' in loaded) { await client.query('ROLLBACK'); return loaded.error }
        let game = loaded.game

        let finished = await settleIfExpired(client, game)
        if (!finished && game.status === 'playing') finished = await applyDig(client, game, playerId!, { r, c })
        if (finished) game = finished

        const view = await snapshot(client, game, playerId!)
        await client.query('COMMIT')
        if (finished) await announceFinish(pool, finished)
        return NextResponse.json(view)
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
    } finally {
        client.release()
    }
}
