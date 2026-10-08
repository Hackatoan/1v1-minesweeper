import type { Board, MinePosition } from './types'

// Same density the setup UI uses to compute maxMines (app/game/[id]/setup/page.tsx)
// and that the winner_id validation in PATCH /api/games/[id] assumes when it
// derives totalNonMines. Kept as one constant so a board that doesn't match it
// can be rejected consistently.
export const MINE_DENSITY = 0.15

// SECURITY: a submitted board's mine_positions is otherwise stored verbatim
// (see POST /api/games/[id]/boards) and later used, unmodified, to decide
// whether the *opponent's* clicks hit a mine. Without validating it here, a
// modified client could submit a board covering every cell in mines (or any
// other out-of-spec layout) to guarantee the opponent explodes on their very
// first move, regardless of what they actually clicked. Reject anything that
// isn't a well-formed, in-bounds, duplicate-free layout at the density every
// legitimate client is constrained to.
export function isValidMineLayout(mines: unknown, boardSize: number): mines is MinePosition[] {
    if (!Array.isArray(mines)) return false

    const expectedCount = Math.floor(boardSize * boardSize * MINE_DENSITY)
    if (mines.length !== expectedCount) return false

    const seen = new Set<string>()
    for (const m of mines) {
        if (!m || typeof m !== 'object') return false
        const { r, c } = m as { r?: unknown; c?: unknown }
        if (typeof r !== 'number' || typeof c !== 'number') return false
        if (!Number.isInteger(r) || !Number.isInteger(c)) return false
        if (r < 0 || r >= boardSize || c < 0 || c >= boardSize) return false
        const key = `${r},${c}`
        if (seen.has(key)) return false
        seen.add(key)
    }
    return true
}

export const calculateAdjacentMines = (r: number, c: number, board: Board, boardSize: number) => {
    let count = 0
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue
            const nr = r + i
            const nc = c + j
            if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
                if (board.mine_positions.some((m: MinePosition) => m.r === nr && m.c === nc)) count++
            }
        }
    }
    return count
}

// Server-side counterpart to the client's flood-fill in handleCellClick
// (app/game/[id]/play/page.tsx). A single dig can legitimately reveal many
// cells at once (a zero-adjacent-mine cell cascades into its neighbors), but
// that cascade is fully determined by the mine layout and whatever this
// player has already revealed — it is never an arbitrary set. This lets the
// moves API recompute the same closure server-side and reject any submitted
// batch that doesn't match exactly one legitimate dig, instead of trusting
// the client to only ever send a real cascade.
export function isValidRevealBatch(
    cells: MinePosition[],
    minePositions: MinePosition[],
    boardSize: number,
    alreadyRevealed: Set<string>
): boolean {
    if (cells.length === 0) return false

    const key = (r: number, c: number) => `${r},${c}`

    // Previously each of these checked the raw mine_positions array with
    // .some()/calculateAdjacentMines, which is O(mines) per cell. The BFS
    // below calls them once per visited cell, so a real cascade on a board
    // with many mines made this O(cells * mines) per submitted move. Building
    // the mine lookup set and the adjacency grid once up front (both already
    // used elsewhere in this file/app for the same reason) turns every
    // per-cell check into O(1), so validating a move is O(cells + mines)
    // instead of O(cells * mines).
    const mineSet = new Set(minePositions.map((m) => key(m.r, m.c)))
    const isMine = (r: number, c: number) => mineSet.has(key(r, c))
    const board: Board = { mine_positions: minePositions }
    const adjacencyGrid = buildAdjacencyGrid(board, boardSize)
    const adjMines = (r: number, c: number) => adjacencyGrid[r][c]

    const cellSet = new Set(cells.map((c) => key(c.r, c.c)))
    if (cellSet.size !== cells.length) return false // duplicate cell within the same batch

    // A lone cell (cascade or not) is always exactly what one click produces.
    if (cells.length === 1) return true

    // Any cascade beyond a single cell only ever originates from a
    // zero-adjacent-mine cell. If none is present, this batch couldn't have
    // come from one real dig.
    const seed = cells.find((c) => adjMines(c.r, c.c) === 0)
    if (!seed) return false

    const visited = new Set<string>([key(seed.r, seed.c)])
    const queue: MinePosition[] = [seed]
    while (queue.length > 0) {
        const cur = queue.shift()!
        if (adjMines(cur.r, cur.c) !== 0) continue
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue
                const nr = cur.r + i
                const nc = cur.c + j
                if (nr < 0 || nr >= boardSize || nc < 0 || nc >= boardSize) continue
                const k = key(nr, nc)
                if (visited.has(k) || alreadyRevealed.has(k) || isMine(nr, nc)) continue
                visited.add(k)
                queue.push({ r: nr, c: nc })
            }
        }
    }

    if (visited.size !== cellSet.size) return false
    for (const k of cellSet) {
        if (!visited.has(k)) return false
    }
    return true
}

// Precomputes the full adjacent-mine-count grid for a board in one pass:
// O(mines * 9) total instead of calling calculateAdjacentMines() per cell
// (O(cells * mines * 9)). Mine positions are fixed once a board is
// submitted, so callers that need counts for many cells — e.g. rendering
// every revealed cell on each render/poll tick — should build this once
// (memoized on the board) and look up counts in O(1) instead of
// recomputing the neighbor scan every time.
export const buildAdjacencyGrid = (board: Board, boardSize: number): number[][] => {
    const grid: number[][] = Array.from({ length: boardSize }, () => new Array(boardSize).fill(0))
    for (const m of board.mine_positions) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue
                const nr = m.r + i
                const nc = m.c + j
                if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
                    grid[nr][nc]++
                }
            }
        }
    }
    return grid
}

// Fraction of a board's safe cells the free opening aims to uncover. Big
// enough to hand the player a few numbers to reason from, small enough that
// the match is still decided by play rather than by the freebie.
const OPENING_TARGET_FRACTION = 0.2

// "Safe start": every player begins a match with a patch of the opponent's
// board already uncovered, so nobody loses on a blind first click. The layout
// is chosen by the *opponent*, so the opening has to be derived from it
// rather than picked up front. It is a pure function of (mines, boardSize),
// which lets the server (which stores it as ordinary moves when the match
// starts) and the solo client share one implementation.
//
// Strategy: flood-fill every zero-adjacent-mine region (the same cascade a
// real click produces) and use the region whose size is closest to the
// target. Ties go to the earliest in row-major order, keeping it
// deterministic. Boards with no zero cell fall back to the lowest-numbered
// safe cell, so there is always at least one number to start from.
export function computeOpening(minePositions: MinePosition[], boardSize: number): MinePosition[] {
    const board: Board = { mine_positions: minePositions }
    const adj = buildAdjacencyGrid(board, boardSize)
    const mineSet = new Set(minePositions.map((m) => `${m.r},${m.c}`))
    const totalSafe = boardSize * boardSize - mineSet.size
    // Never uncover so much that nothing is left to play for.
    const target = Math.max(1, Math.min(Math.round(totalSafe * OPENING_TARGET_FRACTION), totalSafe - 1))

    const visitedZero = new Set<string>()
    let best: MinePosition[] | null = null

    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            const startKey = `${r},${c}`
            if (mineSet.has(startKey) || adj[r][c] !== 0 || visitedZero.has(startKey)) continue

            const region = new Map<string, MinePosition>()
            const queue: MinePosition[] = [{ r, c }]
            region.set(startKey, { r, c })
            while (queue.length > 0) {
                const cur = queue.shift()!
                if (adj[cur.r][cur.c] !== 0) continue
                visitedZero.add(`${cur.r},${cur.c}`)
                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        if (i === 0 && j === 0) continue
                        const nr = cur.r + i
                        const nc = cur.c + j
                        if (nr < 0 || nr >= boardSize || nc < 0 || nc >= boardSize) continue
                        const k = `${nr},${nc}`
                        if (region.has(k) || mineSet.has(k)) continue
                        region.set(k, { r: nr, c: nc })
                        queue.push({ r: nr, c: nc })
                    }
                }
            }

            if (region.size > totalSafe - 1) continue
            if (!best || Math.abs(region.size - target) < Math.abs(best.length - target)) {
                best = [...region.values()]
            }
        }
    }
    if (best) return best

    let lowest: MinePosition | null = null
    let lowestCount = Infinity
    for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
            if (mineSet.has(`${r},${c}`)) continue
            if (adj[r][c] < lowestCount) { lowestCount = adj[r][c]; lowest = { r, c } }
        }
    }
    return lowest ? [lowest] : []
}
