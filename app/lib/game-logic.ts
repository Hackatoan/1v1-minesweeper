import type { Board, MinePosition } from './types'

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
