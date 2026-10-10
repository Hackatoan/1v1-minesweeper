import type { MinePosition } from './types'
import { buildAdjacencyGrid } from './game-logic.ts'
import {
    RUSH_BOARD_SIZE, RUSH_LIVES, RUSH_TIME_CAP_MS,
    rushDensity, rushMineCount, generateRushMines, relocateMine, cascadeFrom, rushWinner,
    type RushProgress,
} from './rush.ts'

// ── Rush vs AI (offline) ────────────────────────────────────────────────────
// Same rules as multiplayer Rush, played entirely in the browser: both sides
// race through endless 6x6 boards, a mine costs a life and skips the board,
// and every board the *other* side clears makes your next one denser. All
// functions here are pure (randomness is injected) so the tests can drive them.

export type RushDiff = 'easy' | 'medium' | 'hard'
export type RandInt = (n: number) => number

// How long the AI "thinks" between digs, per difficulty.
export const RUSH_AI_DELAY: Record<RushDiff, number> = { easy: 2200, medium: 1400, hard: 900 }

export type RushCell = { n: number; hit: boolean }

export type RushSide = {
    idx: number // boards started so far - 1
    mines: MinePosition[]
    grid: number[][] // adjacency counts for `mines`
    revealed: Map<string, RushCell>
    firstDig: boolean // next dig is the first on this board (safe-start applies)
    clears: number
    hits: number
    lastClearAt: number | null
    density: number
    // Set by the most recent dig so the UI can toast / play a sound.
    lastEvent: 'none' | 'hit' | 'clear'
}

const key = (r: number, c: number) => `${r},${c}`

export const livesOf = (s: RushSide) => RUSH_LIVES - s.hits
export const safeTotal = (s: RushSide) => RUSH_BOARD_SIZE * RUSH_BOARD_SIZE - s.mines.length
export const safeRevealed = (s: RushSide) => {
    let n = 0
    for (const c of s.revealed.values()) if (!c.hit) n++
    return n
}

function dealBoard(prev: RushSide | null, oppClears: number, randInt: RandInt): RushSide {
    const clears = prev?.clears ?? 0
    const density = rushDensity(clears, oppClears)
    const mines = generateRushMines(rushMineCount(density), RUSH_BOARD_SIZE, randInt)
    return {
        idx: prev ? prev.idx + 1 : 0,
        mines,
        grid: buildAdjacencyGrid({ mine_positions: mines }, RUSH_BOARD_SIZE),
        revealed: new Map(),
        firstDig: true,
        clears,
        hits: prev?.hits ?? 0,
        lastClearAt: prev?.lastClearAt ?? null,
        density,
        lastEvent: 'none',
    }
}

export const newRushSide = (randInt: RandInt): RushSide => dealBoard(null, 0, randInt)

// Applies one dig. A mine costs a life and deals a fresh board; clearing every
// safe cell scores and deals a fresh board (denser if the opponent is ahead).
export function digRushSide(side: RushSide, at: MinePosition, oppClears: number, now: number, randInt: RandInt): RushSide {
    if (side.revealed.has(key(at.r, at.c))) return side
    let { mines, grid } = side
    const firstDig = side.firstDig
    if (firstDig && mines.some((m) => m.r === at.r && m.c === at.c)) {
        mines = relocateMine(mines, at, RUSH_BOARD_SIZE, randInt)
        grid = buildAdjacencyGrid({ mine_positions: mines }, RUSH_BOARD_SIZE)
    }
    const mineSet = new Set(mines.map((m) => key(m.r, m.c)))

    if (mineSet.has(key(at.r, at.c))) {
        const dealt = dealBoard({ ...side, hits: side.hits + 1 }, oppClears, randInt)
        return { ...dealt, lastEvent: 'hit' }
    }

    const revealed = new Map(side.revealed)
    const already = new Set(revealed.keys())
    for (const cell of cascadeFrom(at, grid, mineSet, already, RUSH_BOARD_SIZE)) {
        revealed.set(key(cell.r, cell.c), { n: grid[cell.r][cell.c], hit: false })
    }

    if (revealed.size >= RUSH_BOARD_SIZE * RUSH_BOARD_SIZE - mines.length) {
        const dealt = dealBoard({ ...side, clears: side.clears + 1 }, oppClears, randInt)
        return { ...dealt, lastClearAt: now, lastEvent: 'clear' }
    }
    return { ...side, mines, grid, revealed, firstDig: false, lastEvent: 'none' }
}

// ── AI ──────────────────────────────────────────────────────────────────────

// Cells the AI can prove are mines / safe from the numbers on screen. Plain
// single-cell logic (n == hidden neighbours → all mines; n == known mines →
// the rest are safe), repeated until nothing new falls out.
export function deduce(side: RushSide): { mines: Set<string>; safe: Set<string> } {
    const size = RUSH_BOARD_SIZE
    const mines = new Set<string>()
    const safe = new Set<string>()
    let changed = true
    while (changed) {
        changed = false
        for (const [k, cell] of side.revealed) {
            if (cell.n === 0) continue
            const [r, c] = k.split(',').map(Number)
            const hidden: string[] = []
            let knownMines = 0
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                if (!dr && !dc) continue
                const nr = r + dr, nc = c + dc
                if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue
                const nk = key(nr, nc)
                if (side.revealed.has(nk)) continue
                if (mines.has(nk)) knownMines++
                else if (!safe.has(nk)) hidden.push(nk)
            }
            if (!hidden.length) continue
            if (hidden.length === cell.n - knownMines) {
                for (const h of hidden) mines.add(h)
                changed = true
            } else if (cell.n === knownMines) {
                for (const h of hidden) safe.add(h)
                changed = true
            }
        }
    }
    return { mines, safe }
}

// Picks the AI's next dig.
//  easy   — any hidden cell, no reasoning
//  medium — digs what the numbers prove safe, otherwise guesses among cells
//           it hasn't proven to be mines
//  hard   — never digs a mine (it can see the layout); prefers cells the
//           numbers already prove safe so it doesn't look like it's cheating
export function pickRushDig(side: RushSide, diff: RushDiff, randInt: RandInt): MinePosition | null {
    const hidden: MinePosition[] = []
    for (let r = 0; r < RUSH_BOARD_SIZE; r++) for (let c = 0; c < RUSH_BOARD_SIZE; c++) {
        if (!side.revealed.has(key(r, c))) hidden.push({ r, c })
    }
    if (!hidden.length) return null
    const pick = (list: MinePosition[]) => list[randInt(list.length)]
    const mineSet = new Set(side.mines.map((m) => key(m.r, m.c)))

    if (diff === 'easy') return pick(hidden)

    const { mines, safe } = deduce(side)
    const provenSafe = hidden.filter((h) => safe.has(key(h.r, h.c)))
    if (provenSafe.length) return pick(provenSafe)

    if (diff === 'hard') {
        const truly = hidden.filter((h) => !mineSet.has(key(h.r, h.c)))
        // First dig on a board is always safe (the mine relocates), so only
        // fall back to any hidden cell if somehow nothing is left.
        return pick(truly.length ? truly : hidden)
    }
    const maybe = hidden.filter((h) => !mines.has(key(h.r, h.c)))
    return pick(maybe.length ? maybe : hidden)
}

// ── Match ───────────────────────────────────────────────────────────────────

export type RushSoloGame = {
    me: RushSide
    ai: RushSide
    startedAt: number
    winner: 'player' | 'ai' | null
}

export const newRushGame = (now: number, randInt: RandInt): RushSoloGame =>
    ({ me: newRushSide(randInt), ai: newRushSide(randInt), startedAt: now, winner: null })

const toProgress = (s: RushSide): RushProgress => ({
    currentIdx: s.idx, clears: s.clears, hits: s.hits, lives: livesOf(s), lastClearAt: s.lastClearAt, current: null,
})

// Last alive wins; otherwise the time cap decides (clears → lives → earlier
// last clear). The player wins an exact tie (rushWinner breaks the final tie
// by lowest id, hence '0' for the player and '1' for the AI).
export function rushSoloWinner(g: Pick<RushSoloGame, 'me' | 'ai'>): 'player' | 'ai' {
    return rushWinner(toProgress(g.me), '0', toProgress(g.ai), '1') === '0' ? 'player' : 'ai'
}

// Settles the match if it's over (a side out of lives, or the clock ran out).
export function settle(g: RushSoloGame, now: number): RushSoloGame {
    if (g.winner) return g
    const over = livesOf(g.me) <= 0 || livesOf(g.ai) <= 0 || now - g.startedAt >= RUSH_TIME_CAP_MS
    return over ? { ...g, winner: rushSoloWinner(g) } : g
}

export function digRushGame(g: RushSoloGame, who: 'player' | 'ai', at: MinePosition, now: number, randInt: RandInt): RushSoloGame {
    if (g.winner) return g
    const next = who === 'player'
        ? { ...g, me: digRushSide(g.me, at, g.ai.clears, now, randInt) }
        : { ...g, ai: digRushSide(g.ai, at, g.me.clears, now, randInt) }
    return settle(next, now)
}
