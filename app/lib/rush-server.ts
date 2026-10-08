import { randomInt } from 'node:crypto'
import type { PoolClient } from 'pg'
import { buildAdjacencyGrid } from './game-logic'
import { recordMatch } from './leaderboard'
import {
    RUSH_BOARD_SIZE, RUSH_LIVES, RUSH_TIME_CAP_MS,
    cascadeFrom, generateRushMines, relocateMine, rushDensity, rushMineCount, rushWinner, summarizeRush,
    type RushBoardRow, type RushMoveRow, type RushProgress,
} from './rush'
import type { Game, MinePosition } from './types'

// Anything with a pg-style query() — a Pool or a transaction's PoolClient.
export type Db = Pick<PoolClient, 'query'>

export async function loadProgress(db: Db, gameId: string, playerId: string): Promise<RushProgress> {
    const [boards, moves] = await Promise.all([
        db.query('SELECT idx, density, mine_positions FROM rush_boards WHERE game_id = $1 AND player_id = $2 ORDER BY idx', [gameId, playerId]),
        db.query('SELECT cell, hit_mine, board_idx, timestamp FROM moves WHERE game_id = $1 AND player_id = $2', [gameId, playerId]),
    ])
    return summarizeRush(boards.rows as RushBoardRow[], moves.rows as RushMoveRow[], RUSH_BOARD_SIZE)
}

// Creates the player's next board if it doesn't exist yet. Density is frozen
// at creation from the current standings, so a board never changes under the
// player once they can see it.
export async function ensureBoard(db: Db, gameId: string, playerId: string, mine: RushProgress, opp: RushProgress) {
    if (mine.current) return
    const density = rushDensity(mine.clears, opp.clears)
    const mines = generateRushMines(rushMineCount(density), RUSH_BOARD_SIZE, (n) => randomInt(n))
    await db.query(
        `INSERT INTO rush_boards (game_id, player_id, idx, density, mine_positions)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [gameId, playerId, mine.currentIdx, density, JSON.stringify(mines)]
    )
}

export function opponentOf(game: Game, playerId: string): string | null {
    if (playerId === game.player1_id) return game.player2_id ?? null
    if (playerId === game.player2_id) return game.player1_id
    return null
}

export function isExpired(game: Game): boolean {
    if (!game.started_at) return false
    return Date.now() - new Date(game.started_at).getTime() >= RUSH_TIME_CAP_MS
}

// Flips playing → finished exactly once. Returns the finished row when this
// call did the flip (so the caller records the leaderboard result after its
// transaction commits), null if somebody else already finished it.
export async function finishGame(db: Db, gameId: string, winnerId: string): Promise<Game | null> {
    const { rows } = await db.query(
        `UPDATE games SET status = 'finished'::game_status, winner_id = $2, last_ping = now()
         WHERE id = $1 AND status = 'playing'::game_status RETURNING *`,
        [gameId, winnerId]
    )
    return rows[0] ?? null
}

export async function announceFinish(db: Db, game: Game) {
    const winnerName = game.winner_id === game.player1_id ? game.player1_name : game.player2_name
    // Names may be null for anonymous players; the SDK skips those (same as the classic PATCH path).
    recordMatch(game.player1_name as string, game.player2_name as string, winnerName ?? null, game.player1_uid ?? null, game.player2_uid ?? null)
    await db.query('SELECT increment_games_played()').catch(() => {})
}

// Decides a match whose clock ran out. Caller holds the game-row lock.
export async function settleIfExpired(db: Db, game: Game): Promise<Game | null> {
    if (game.status !== 'playing' || !isExpired(game) || !game.player2_id) return null
    const [a, b] = await Promise.all([
        loadProgress(db, game.id, game.player1_id),
        loadProgress(db, game.id, game.player2_id),
    ])
    return finishGame(db, game.id, rushWinner(a, game.player1_id, b, game.player2_id))
}

export type RushView = ReturnType<typeof buildView>

// What a player may see. Their own mines never leave the server — only the
// revealed cells with their numbers — and the opponent is reduced to stats.
export function buildView(game: Game, me: RushProgress, opp: RushProgress) {
    const cur = me.current
    const oppCur = opp.current
    return {
        status: game.status,
        winner_id: game.winner_id ?? null,
        started_at: game.started_at ?? null,
        cap_ms: RUSH_TIME_CAP_MS,
        server_now: Date.now(),
        size: RUSH_BOARD_SIZE,
        max_lives: RUSH_LIVES,
        me: {
            lives: me.lives,
            clears: me.clears,
            idx: me.currentIdx,
            density: cur?.board.density ?? null,
            mines: cur?.board.mine_positions.length ?? 0,
            safe_total: cur?.safeTotal ?? 0,
            safe_revealed: cur?.safeRevealed ?? 0,
            revealed: cur?.revealed ?? [],
        },
        opp: {
            lives: opp.lives,
            clears: opp.clears,
            idx: opp.currentIdx,
            density: oppCur?.board.density ?? null,
            safe_total: oppCur?.safeTotal ?? 0,
            safe_revealed: oppCur?.safeRevealed ?? 0,
        },
    }
}

// Applies one click for `playerId`. Caller holds the game-row lock inside a
// transaction. Returns the game row if this click ended the match.
export async function applyDig(db: Db, game: Game, playerId: string, cell: MinePosition): Promise<Game | null> {
    const oppId = opponentOf(game, playerId)
    if (!oppId) return null
    const size = RUSH_BOARD_SIZE

    let [me, opp] = await Promise.all([loadProgress(db, game.id, playerId), loadProgress(db, game.id, oppId)])
    if (me.lives <= 0) return null
    if (!me.current) {
        await ensureBoard(db, game.id, playerId, me, opp)
        me = await loadProgress(db, game.id, playerId)
    }
    const cur = me.current
    if (!cur) return null

    const taken = new Set(cur.revealed.map((x) => `${x.r},${x.c}`))
    if (taken.has(`${cell.r},${cell.c}`)) return null // already open: idempotent no-op

    let minePositions = cur.board.mine_positions
    // Safe first click: nobody dies on the first dig of a board.
    if (cur.revealed.length === 0 && minePositions.some((m) => m.r === cell.r && m.c === cell.c)) {
        minePositions = relocateMine(minePositions, cell, size, (n) => randomInt(n))
        await db.query('UPDATE rush_boards SET mine_positions = $4 WHERE game_id = $1 AND player_id = $2 AND idx = $3',
            [game.id, playerId, cur.board.idx, JSON.stringify(minePositions)])
    }
    const mineSet = new Set(minePositions.map((m) => `${m.r},${m.c}`))
    const hit = mineSet.has(`${cell.r},${cell.c}`)
    const cells = hit
        ? [cell]
        : cascadeFrom(cell, buildAdjacencyGrid({ mine_positions: minePositions }, size), mineSet, taken, size)

    const values: unknown[] = []
    const tuples = cells.map((c, i) => {
        values.push(game.id, playerId, JSON.stringify(c), hit, cur.board.idx)
        const b = i * 5
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`
    })
    await db.query(`INSERT INTO moves (game_id, player_id, cell, hit_mine, board_idx) VALUES ${tuples.join(', ')}`, values)

    const after = await loadProgress(db, game.id, playerId)
    if (after.currentIdx === me.currentIdx) return null // board still in play

    if (after.lives <= 0) return finishGame(db, game.id, oppId)
    opp = await loadProgress(db, game.id, oppId)
    await ensureBoard(db, game.id, playerId, after, opp)
    return null
}
