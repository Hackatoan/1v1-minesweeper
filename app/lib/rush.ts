import type { MinePosition } from './types'
import { buildAdjacencyGrid } from './game-logic.ts'

// ── Rush mode ───────────────────────────────────────────────────────────────
// Instead of placing a board for the opponent, each player gets an endless
// stream of small server-generated boards. A mine costs a life and skips the
// board; clearing a board is a point. Everything in this file is pure so the
// API routes (authoritative) and the tests share one implementation.

export const RUSH_BOARD_SIZE = 6
export const RUSH_LIVES = 3
export const RUSH_TIME_CAP_MS = 180_000

export const RUSH_BASE_DENSITY = 0.12
export const RUSH_DENSITY_STEP = 0.04
export const RUSH_MAX_DENSITY = 0.4

// Rubber-band: the player who is ahead on cleared boards gets denser boards
// (+STEP per board of lead); a tied or trailing player drops back to BASE.
// To flip it to the "your clears make the opponent's next board harder"
// variant, swap the arguments' roles: base the lead on (oppClears - myClears).
export function rushDensity(myClears: number, oppClears: number): number {
    const lead = Math.max(0, myClears - oppClears)
    return Math.min(RUSH_MAX_DENSITY, RUSH_BASE_DENSITY + RUSH_DENSITY_STEP * lead)
}

export function rushMineCount(density: number, size: number = RUSH_BOARD_SIZE): number {
    const cells = size * size
    return Math.min(cells - 2, Math.max(1, Math.round(cells * density)))
}

// Standard "safe first click": if the first dig on a fresh board lands on a
// mine, that mine moves to a random free cell. Returns the new layout.
export function relocateMine(mines: MinePosition[], clicked: MinePosition, size: number, randInt: (n: number) => number): MinePosition[] {
    const occupied = new Set(mines.map((m) => key(m.r, m.c)))
    const free: MinePosition[] = []
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!occupied.has(key(r, c))) free.push({ r, c })
    const dest = free[randInt(free.length)]
    return mines.filter((m) => !(m.r === clicked.r && m.c === clicked.c)).concat(dest)
}

// `randInt(n)` returns an integer in [0, n). Injected so the server can use
// crypto and the tests a seeded generator.
export function generateRushMines(count: number, size: number, randInt: (n: number) => number): MinePosition[] {
    const cells: number[] = Array.from({ length: size * size }, (_, i) => i)
    for (let i = 0; i < count; i++) {
        const j = i + randInt(cells.length - i)
        ;[cells[i], cells[j]] = [cells[j], cells[i]]
    }
    return cells.slice(0, count).map((i) => ({ r: Math.floor(i / size), c: i % size }))
}

export type RushBoardRow = { idx: number; density: number; mine_positions: MinePosition[] }
export type RushMoveRow = { cell: MinePosition; hit_mine: boolean; board_idx: number; timestamp?: string | Date }
export type RushRevealed = { r: number; c: number; n: number; hit?: boolean }

export type RushCurrent = {
    board: RushBoardRow
    revealed: RushRevealed[]
    safeTotal: number
    safeRevealed: number
}

export type RushProgress = {
    currentIdx: number // first unresolved board index; its row may not exist yet
    clears: number
    hits: number
    lives: number
    lastClearAt: number | null
    current: RushCurrent | null
}

const key = (r: number, c: number) => `${r},${c}`

function boardReveals(board: RushBoardRow, moves: RushMoveRow[], size: number) {
    const grid = buildAdjacencyGrid({ mine_positions: board.mine_positions }, size)
    const revealed = new Map<string, RushRevealed>()
    for (const m of moves) {
        const { r, c } = m.cell
        revealed.set(key(r, c), m.hit_mine ? { r, c, n: 0, hit: true } : { r, c, n: grid[r][c] })
    }
    const safeTotal = size * size - board.mine_positions.length
    let safeRevealed = 0
    for (const cell of revealed.values()) if (!cell.hit) safeRevealed++
    return { grid, revealed, safeTotal, safeRevealed }
}

// Derives one player's whole run from their boards + recorded moves. A board
// is resolved by a mine hit (life lost, board skipped) or by revealing every
// safe cell (clear). The first unresolved board is the one in play.
export function summarizeRush(boards: RushBoardRow[], moves: RushMoveRow[], size: number = RUSH_BOARD_SIZE): RushProgress {
    const byIdx = new Map(boards.map((b) => [b.idx, b]))
    const movesByIdx = new Map<number, RushMoveRow[]>()
    for (const m of moves) {
        const list = movesByIdx.get(m.board_idx)
        if (list) list.push(m)
        else movesByIdx.set(m.board_idx, [m])
    }

    let idx = 0
    let clears = 0
    let hits = 0
    let lastClearAt: number | null = null
    for (;;) {
        const board = byIdx.get(idx)
        const done = (current: RushCurrent | null): RushProgress =>
            ({ currentIdx: idx, clears, hits, lives: RUSH_LIVES - hits, lastClearAt, current })
        if (!board) return done(null)

        const bm = movesByIdx.get(idx) ?? []
        if (bm.some((m) => m.hit_mine)) { hits++; idx++; continue }

        const { revealed, safeTotal, safeRevealed } = boardReveals(board, bm, size)
        if (safeRevealed >= safeTotal) {
            clears++
            for (const m of bm) {
                const t = m.timestamp ? new Date(m.timestamp).getTime() : 0
                if (lastClearAt === null || t > lastClearAt) lastClearAt = t
            }
            idx++
            continue
        }
        return done({ board, revealed: [...revealed.values()], safeTotal, safeRevealed })
    }
}

// The cells a click on `start` reveals: just itself if it borders a mine,
// otherwise the zero-cascade — same closure the classic mode uses.
export function cascadeFrom(
    start: MinePosition,
    grid: number[][],
    mineSet: Set<string>,
    alreadyRevealed: Set<string>,
    size: number
): MinePosition[] {
    const out: MinePosition[] = []
    const seen = new Set<string>([key(start.r, start.c)])
    const queue: MinePosition[] = [start]
    while (queue.length > 0) {
        const cur = queue.shift()!
        out.push(cur)
        if (grid[cur.r][cur.c] !== 0) continue
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue
                const nr = cur.r + i
                const nc = cur.c + j
                if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue
                const k = key(nr, nc)
                if (seen.has(k) || alreadyRevealed.has(k) || mineSet.has(k)) continue
                seen.add(k)
                queue.push({ r: nr, c: nc })
            }
        }
    }
    return out
}

// Time-cap tiebreak: more boards cleared, then more lives, then whoever
// reached their clear count first, then a stable id order so it never draws.
export function rushWinner(a: RushProgress, aId: string, b: RushProgress, bId: string): string {
    if (a.lives <= 0 && b.lives > 0) return bId
    if (b.lives <= 0 && a.lives > 0) return aId
    if (a.clears !== b.clears) return a.clears > b.clears ? aId : bId
    if (a.lives !== b.lives) return a.lives > b.lives ? aId : bId
    if (a.lastClearAt !== b.lastClearAt) {
        if (a.lastClearAt === null) return bId
        if (b.lastClearAt === null) return aId
        return a.lastClearAt < b.lastClearAt ? aId : bId
    }
    return aId < bId ? aId : bId
}
