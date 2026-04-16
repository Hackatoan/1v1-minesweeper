export const calculateAdjacentMines = (r: number, c: number, minePositionsSet: Set<string>, boardSize: number) => {
    let count = 0
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue
            const nr = r + i
            const nc = c + j
            if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
                if (minePositionsSet.has(`${nr},${nc}`)) count++
            }
        }
    }
    return count
}
