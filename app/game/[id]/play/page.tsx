'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getPlayerId } from '../../../lib/session'
import { getGame, getBoards, getMoves, insertMoves, updateGame, incrementGamesPlayed } from '../../../lib/api-client'
import { useGamePresence } from '../../../lib/useGamePresence'
import { calculateAdjacentMines } from '../../../lib/game-logic'
import { Board, MinePosition } from '../../../lib/types'
import useLongPress from '../../../lib/useLongPress'

const NUMBER_COLORS = ['text-transparent', 'text-blue-500', 'text-orange-500', 'text-rose-500', 'text-purple-500', 'text-amber-500', 'text-cyan-500', 'text-zinc-800', 'text-zinc-500']

function MineCellButton({
  r, c, isRevealed, hitMine, adjacentMines, isFlagged,
  onDig, onFlag
}: {
  r: number; c: number
  isRevealed: boolean; hitMine: boolean; adjacentMines: number; isFlagged: boolean
  onDig: (r: number, c: number) => void
  onFlag: (r: number, c: number) => void
}) {
  const longPress = useLongPress(
    () => onFlag(r, c),
    () => onDig(r, c)
  )

  if (isRevealed) {
    return (
      <div className={`mine-cell w-10 h-10 sm:w-12 sm:h-12 text-xl font-black flex items-center justify-center
        ${hitMine ? 'bg-rose-500 shadow-inner' : 'bg-brown-700 border border-brown-600/50 shadow-inner'}`}>
        {hitMine && '💥'}
        {!hitMine && adjacentMines > 0 && <span className={NUMBER_COLORS[adjacentMines] || 'text-zinc-800'}>{adjacentMines}</span>}
      </div>
    )
  }

  return (
    <button
      {...longPress}
      onContextMenu={(e) => { e.preventDefault(); onFlag(r, c) }}
      className="mine-cell w-10 h-10 sm:w-12 sm:h-12 text-xl font-black flex items-center justify-center bg-brown-600 border border-brown-500/50 hover:bg-pink-300 cursor-pointer shadow-sm hover:shadow active:scale-95"
    >
      {isFlagged && '🚩'}
    </button>
  )
}

export default function PlayPhase() {
  const router = useRouter()
  const params = useParams()
  const gameId = params.id as string

  const [game, setGame] = useState<any>(null)
  const boardSize = game?.board_size || 10
  const maxMines = Math.floor((boardSize * boardSize) * 0.15)

  const [userId, setUserId] = useState<string | null>(null)
  const [myBoard, setMyBoard] = useState<Board | null>(null)
  const [opponentBoard, setOpponentBoard] = useState<Board | null>(null)
  const [myMoves, setMyMoves] = useState<any[]>([])
  const [opponentMoves, setOpponentMoves] = useState<any[]>([])
  const [flags, setFlags] = useState<MinePosition[]>([])
  const [flagMode, setFlagMode] = useState(false)
  const [loading, setLoading] = useState(true)

  const onlineUsers = useGamePresence(gameId, game)
  const isOpponentOnline = game ? (game.player1_id === userId ? onlineUsers.includes(game.player2_id) : onlineUsers.includes(game.player1_id)) : false

  useEffect(() => {
    async function init() {
      const uid = getPlayerId()
      if (!uid) return router.push('/')
      setUserId(uid)

      const gameData = await getGame(gameId)
      if (!gameData || gameData.status !== 'playing') {
        if (gameData?.status === 'finished') router.push(`/game/${gameId}/result`)
      }
      setGame(gameData)

      const boardsData = await getBoards(gameId)
      const myB = boardsData?.find((b: any) => b.owner_id === uid)
      const oppB = boardsData?.find((b: any) => b.owner_id !== uid)
      setMyBoard(myB)
      setOpponentBoard(oppB)

      const movesData = await getMoves(gameId)
      setMyMoves(movesData?.filter((m: any) => m.player_id === uid) || [])
      setOpponentMoves(movesData?.filter((m: any) => m.player_id !== uid) || [])

      setLoading(false)
    }

    init()
  }, [gameId, router])

  // Polling for game/moves updates
  useEffect(() => {
    if (!userId) return
    const interval = setInterval(async () => {
      const [updatedGame, updatedMoves] = await Promise.all([getGame(gameId), getMoves(gameId)])
      if (updatedGame?.status === 'finished') router.push(`/game/${gameId}/result`)
      setGame(updatedGame)
      const myId = getPlayerId()
      setMyMoves(updatedMoves.filter((m: any) => m.player_id === myId))
      setOpponentMoves(updatedMoves.filter((m: any) => m.player_id !== myId))
    }, 1500)
    return () => clearInterval(interval)
  }, [userId, gameId, router])

  const toggleFlag = (r: number, c: number) => {
      if (myMoves.some(m => m.cell.r === r && m.cell.c === c)) return
      setFlags(prev => {
          const isFlagged = prev.some(f => f.r === r && f.c === c)
          if (isFlagged) {
              return prev.filter(f => !(f.r === r && f.c === c))
          } else {
              return [...prev, {r, c}]
          }
      })
  }

  const handleCellAction = (r: number, c: number) => {
    if (flagMode) {
      toggleFlag(r, c)
    } else {
      handleCellClick(r, c)
    }
  }

  const handleCellClick = async (r: number, c: number) => {
      if (!userId || !opponentBoard) return
      if (myMoves.some(m => m.cell.r === r && m.cell.c === c)) return
      if (flags.some(f => f.r === r && f.c === c)) return

      const isMine = (row: number, col: number) =>
          opponentBoard.mine_positions.some((m: any) => m.r === row && m.c === col)

      const hitMine = isMine(r, c)

      const movesToInsertMap = new Map<string, any>()

      if (hitMine) {
          movesToInsertMap.set(`${r},${c}`, { cell: { r, c }, hit_mine: true })
      } else {
          // Flood fill
          const queue = [{r, c}]
          const visited = new Set<string>()
          visited.add(`${r},${c}`)

          while (queue.length > 0) {
              const current = queue.shift()!
              const adjMines = calculateAdjacentMines(current.r, current.c, opponentBoard, boardSize)

              movesToInsertMap.set(`${current.r},${current.c}`, {
                  cell: { r: current.r, c: current.c },
                  hit_mine: false
              })

              if (adjMines === 0) {
                  for (let i = -1; i <= 1; i++) {
                      for (let j = -1; j <= 1; j++) {
                          if (i === 0 && j === 0) continue
                          const nr = current.r + i
                          const nc = current.c + j

                          if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
                              const key = `${nr},${nc}`
                              if (!visited.has(key) && !myMoves.some(m => m.cell.r === nr && m.cell.c === nc) && !movesToInsertMap.has(key)) {
                                  visited.add(key)
                                  if (!isMine(nr, nc)) {
                                      queue.push({r: nr, c: nc})
                                  }
                              }
                          }
                      }
                  }
              }
          }
      }

      const movesToInsert = Array.from(movesToInsertMap.values())

      setMyMoves(prev => {
        const newMoves = movesToInsert.filter(m => !prev.some(pm => pm.cell.r === m.cell.r && pm.cell.c === m.cell.c))
        return [...prev, ...newMoves]
      })
      setFlags(prev => prev.filter(f => !movesToInsert.some(m => m.cell.r === f.r && m.cell.c === f.c)))

      try {
        await insertMoves(gameId, movesToInsert)
      } catch (error) {
        console.error('Error inserting moves:', error)
        return
      }

      if (hitMine) {
          await updateGame(gameId, { status: 'finished', winner_id: opponentBoard.owner_id })
          await incrementGamesPlayed()
      } else {
          // Because state update is async, we use the local calculated total length
          const currentTotalMoves = [...myMoves, ...movesToInsert].reduce((acc, m) => {
            const key = `${m.cell.r},${m.cell.c}`
            if (!m.hit_mine && !acc.has(key)) {
              acc.add(key)
            }
            return acc
          }, new Set<string>()).size
          const totalNonMines = (boardSize * boardSize) - maxMines
          if (currentTotalMoves >= totalNonMines) {
              await updateGame(gameId, { status: 'finished', winner_id: userId })
              await incrementGamesPlayed()
          }
      }
  }

  if (loading) return (
      <div className="flex flex-1 w-full items-center justify-center bg-brown-900/50">
          <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full"></div>
      </div>
  )

  const forfeitGame = async () => {
    if (!userId || !game) return
    if (confirm('Are you sure you want to forfeit? Your opponent will win.')) {
      const winnerId = game.player1_id === userId ? game.player2_id : game.player1_id
      await updateGame(gameId, { status: 'finished', winner_id: winnerId })
      await incrementGamesPlayed()
      router.push('/')
    }
  }

  const myMovesMap = new Map<string, any>()
  myMoves.forEach(m => myMovesMap.set(`${m.cell.r},${m.cell.c}`, m))

  const flagsSet = new Set<string>()
  flags.forEach(f => flagsSet.add(`${f.r},${f.c}`))

  const myMinesSet = new Set<string>()
  if (myBoard?.mine_positions) {
    myBoard.mine_positions.forEach((m: any) => myMinesSet.add(`${m.r},${m.c}`))
  }

  const opponentMovesMap = new Map<string, any>()
  opponentMoves.forEach(m => opponentMovesMap.set(`${m.cell.r},${m.cell.c}`, m))

  let mySafeMovesCount = 0;
  for (const move of myMovesMap.values()) {
    if (!move.hit_mine) mySafeMovesCount++;
  }

  let opponentSafeMovesCount = 0;
  for (const move of opponentMovesMap.values()) {
    if (!move.hit_mine) opponentSafeMovesCount++;
  }

  const toggleButtonClasses = (active: boolean, variant: 'dig' | 'flag') =>
    `px-4 py-2 rounded-lg font-bold text-sm transition-all ${
      active
        ? variant === 'flag' ? 'bg-rose-500 text-white shadow-md' : 'bg-brown-600 border border-brown-500/50 hover:bg-brown-500 text-white shadow-md'
        : 'text-pink-300/60 hover:text-brown-700 hover:bg-brown-700 border border-brown-600/50 shadow-inner'
    }`

  return (
    <div className="flex flex-1 w-full flex-col items-center justify-center p-6 from-transparent to-transparent">
      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center lg:items-start pt-4 pb-28 lg:pb-20">

        {!isOpponentOnline && (
          <div className="col-span-full bg-rose-950/30 border border-rose-900/50 text-rose-400 px-6 py-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-bold">Opponent Disconnected</p>
                <p className="text-sm opacity-90">Your opponent has left the game or lost connection. You can wait for them to return or leave the game.</p>
              </div>
            </div>
            <button
              onClick={forfeitGame}
              className="bg-rose-900/50 hover:bg-rose-800 text-rose-200 px-4 py-2 rounded-xl font-bold transition-colors whitespace-nowrap"
            >
              Leave Game
            </button>
          </div>
        )}

        {/* Opponent's Board (The one I click) */}
        <div className="flex flex-col items-center gap-4 sm:gap-6 bg-brown-800 border-brown-700 p-4 sm:p-8 rounded-3xl shadow-xl border border-brown-700 order-first lg:order-last">
            <div className="text-center w-full flex flex-col items-center">
                <h2 className="text-3xl font-extrabold text-pink-100">Attack Board</h2>
                <p className="text-pink-300/60 mt-2">Find safe zones. Avoid the mines!</p>
                {/* Desktop toggle — hidden on mobile (sticky bar handles it) */}
                <div className="hidden lg:flex mt-4 gap-2 bg-brown-900/50 p-1 rounded-xl shadow-inner border border-brown-700/50">
                    <button onClick={() => setFlagMode(false)} className={toggleButtonClasses(!flagMode, 'dig')}>⛏️ Dig</button>
                    <button onClick={() => setFlagMode(true)} className={toggleButtonClasses(flagMode, 'flag')}>🚩 Flag</button>
                </div>
                {/* Mobile hint */}
                <p className="lg:hidden text-xs text-pink-300/40 mt-3">Tap to dig · Hold to flag</p>
            </div>

            <div
                className="mine-grid shadow-lg"
                style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
            >
                {Array.from({ length: boardSize }).map((_, r) => (
                Array.from({ length: boardSize }).map((_, c) => {
                    const key = `${r},${c}`
                    const move = myMovesMap.get(key)
                    const isRevealed = !!move
                    const hitMine = move?.hit_mine ?? false
                    const adjacentMines = isRevealed && !hitMine && opponentBoard ? calculateAdjacentMines(r, c, opponentBoard, boardSize) : 0
                    const isFlagged = flagsSet.has(key)

                    return (
                      <MineCellButton
                        key={`opp-${r}-${c}`}
                        r={r} c={c}
                        isRevealed={isRevealed}
                        hitMine={hitMine}
                        adjacentMines={adjacentMines}
                        isFlagged={isFlagged}
                        onDig={handleCellAction}
                        onFlag={toggleFlag}
                      />
                    )
                })
                ))}
            </div>

            <div className="bg-brown-900/50 px-6 py-3 rounded-2xl border border-brown-700/50 flex flex-col items-center shadow-inner w-full">
                <div className="text-sm text-pink-300/60 font-bold uppercase tracking-wider mb-1">Progress</div>
                <div className="text-2xl font-mono font-bold text-pink-400">
                    {mySafeMovesCount} <span className="text-brown-400">/</span> {(boardSize * boardSize) - maxMines}
                </div>
            </div>

            <div className="mt-2 w-full flex justify-center">
              <button
                onClick={forfeitGame}
                className="text-brown-400 hover:text-rose-600 font-medium transition-colors hover:underline text-sm"
              >
                Forfeit Match
              </button>
            </div>
        </div>

        {/* My Board (Mini map to watch opponent) */}
        <div className="hidden lg:flex flex-col items-center gap-6 bg-brown-800 border-brown-700/60 p-8 rounded-3xl border border-brown-700/50 order-last lg:order-first">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-brown-700">Your Defenses</h2>
                <p className="text-sm text-pink-300/60 mt-1">Watch your opponent&apos;s progress</p>
            </div>

            <div
                className="mine-grid opacity-90"
                style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
            >
                {Array.from({ length: boardSize }).map((_, r) => (
                Array.from({ length: boardSize }).map((_, c) => {
                    const key = `${r},${c}`
                    const isMine = myMinesSet.has(key)
                    const oppMove = opponentMovesMap.get(key)
                    const oppRevealed = !!oppMove
                    const oppHitMine = oppMove?.hit_mine

                    return (
                    <div
                        key={`my-${r}-${c}`}
                        className={`mine-cell w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-sm flex items-center justify-center
                        ${oppHitMine ? 'bg-rose-500 text-white'
                          : oppRevealed ? 'bg-brown-700 border border-brown-600/50 shadow-inner'
                          : isMine ? 'bg-brown-400'
                          : 'bg-brown-300'}
                        `}
                    >
                        {isMine && !oppRevealed && '💣'}
                        {oppHitMine && '💥'}
                        {oppRevealed && !oppHitMine && <span className="text-pink-400 font-bold">✓</span>}
                    </div>
                    )
                })
                ))}
            </div>

            <div className="bg-brown-900/50/80 px-6 py-3 rounded-2xl border border-brown-700/50 flex flex-col items-center w-full">
                <div className="text-xs text-pink-300/60 font-bold uppercase tracking-wider mb-1">Opponent Progress</div>
                <div className="text-lg font-mono font-bold text-brown-700">
                    {opponentSafeMovesCount} <span className="text-brown-400">/</span> {(boardSize * boardSize) - maxMines}
                </div>
            </div>
        </div>

      </div>

      {/* Sticky mobile toggle — always visible at bottom of screen */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 p-4 bg-brown-900/95 border-t border-brown-700/60 backdrop-blur-sm flex items-center justify-center gap-3">
        <button
          onClick={() => setFlagMode(false)}
          className={`flex-1 max-w-40 py-3 rounded-xl font-bold text-base transition-all ${toggleButtonClasses(!flagMode, 'dig')}`}
        >
          ⛏️ Dig
        </button>
        <button
          onClick={() => setFlagMode(true)}
          className={`flex-1 max-w-40 py-3 rounded-xl font-bold text-base transition-all ${toggleButtonClasses(flagMode, 'flag')}`}
        >
          🚩 Flag
        </button>
      </div>
    </div>
  )
}
