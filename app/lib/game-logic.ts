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
    const isMine = (r: number, c: number) => minePositions.some((m) => m.r === r && m.c === c)
    const board: Board = { mine_positions: minePositions }
    const adjMines = (r: number, c: number) => calculateAdjacentMines(r, c, board, boardSize)

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
