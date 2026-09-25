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
