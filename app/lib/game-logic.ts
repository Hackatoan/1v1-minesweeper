import { BOARD_SIZE } from './constants'

export const calculateAdjacentMines = (r: number, c: number, board: any) => {
  let count = 0
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue
      const nr = r + i
      const nc = c + j
      if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
        if (board.mine_positions.some((m: any) => m.r === nr && m.c === nc)) count++
      }
    }
  }
  return count
}
