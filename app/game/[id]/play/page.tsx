'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getSession } from '../../../lib/supabase'
import useLongPress from '../../../lib/useLongPress'

// boardSize removed
// maxMines removed

export default function PlayPhase() {
  const router = useRouter()
  const params = useParams()
  const gameId = params.id as string

  const [game, setGame] = useState<any>(null)
  const boardSize = game?.board_size || 10
  const maxMines = Math.floor((boardSize * boardSize) * 0.15)

  const [userId, setUserId] = useState<string | null>(null)
  const [myBoard, setMyBoard] = useState<any>(null)
  const [opponentBoard, setOpponentBoard] = useState<any>(null)
  const [myMoves, setMyMoves] = useState<any[]>([])
  const [opponentMoves, setOpponentMoves] = useState<any[]>([])
  const [flags, setFlags] = useState<{r: number, c: number}[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let subscription: any

    async function init() {
      const session = await getSession()
      const uid = session?.user.id
      if (!uid) return router.push('/')
      setUserId(uid)

      const { data: gameData } = await supabase.from('games').select('*').eq('id', gameId).single()
      if (!gameData || gameData.status !== 'playing') {
          if (gameData?.status === 'finished') router.push(`/game/${gameId}/result`)
      }
      setGame(gameData)

      const { data: boardsData } = await supabase.from('boards').select('*').eq('game_id', gameId)
      const myB = boardsData?.find(b => b.owner_id === uid)
      const oppB = boardsData?.find(b => b.owner_id !== uid)
      setMyBoard(myB)
      setOpponentBoard(oppB)

      const { data: movesData } = await supabase.from('moves').select('*').eq('game_id', gameId)
      setMyMoves(movesData?.filter(m => m.player_id === uid) || [])
      setOpponentMoves(movesData?.filter(m => m.player_id !== uid) || [])

      subscription = supabase
        .channel(`game-play-${gameId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
           if (payload.new.status === 'finished') {
               router.push(`/game/${gameId}/result`)
           }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'moves', filter: `game_id=eq.${gameId}` }, (payload) => {
            if (payload.new.player_id === uid) {
                setMyMoves(prev => [...prev, payload.new])
            } else {
                setOpponentMoves(prev => [...prev, payload.new])
            }
        })
        .subscribe()

        setLoading(false)
    }

    init()

    return () => {
      if (subscription) supabase.removeChannel(subscription)
    }
  }, [gameId, router])

  const calculateAdjacentMines = (r: number, c: number, board: any) => {
      let count = 0
      for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
              if (i === 0 && j === 0) continue
              const nr = r + i
              const nc = c + j
              if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
                  if (board.mine_positions.some((m: any) => m.r === nr && m.c === nc)) count++
              }
          }
      }
      return count
  }

  const toggleFlag = (e: React.MouseEvent | React.TouchEvent, r: number, c: number) => {
      e.preventDefault()
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


  const handleCellClick = async (r: number, c: number) => {
      if (!userId || !opponentBoard) return
      if (myMoves.some(m => m.cell.r === r && m.cell.c === c)) return
      if (flags.some(f => f.r === r && f.c === c)) return

      const isMine = (row: number, col: number) =>
          opponentBoard.mine_positions.some((m: any) => m.r === row && m.c === col)

      const hitMine = isMine(r, c)

      let movesToInsert: any[] = []

      if (hitMine) {
          movesToInsert.push({ game_id: gameId, player_id: userId, cell: { r, c }, hit_mine: true })
      } else {
          // Flood fill
          const queue = [{r, c}]
          const visited = new Set<string>()
          visited.add(`${r},${c}`)

          while (queue.length > 0) {
              const current = queue.shift()!
              const adjMines = calculateAdjacentMines(current.r, current.c, opponentBoard)

              movesToInsert.push({
                  game_id: gameId,
                  player_id: userId,
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
                              if (!visited.has(key) && !myMoves.some(m => m.cell.r === nr && m.cell.c === nc)) {
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

      setMyMoves(prev => [...prev, ...movesToInsert])
      setFlags(prev => prev.filter(f => !movesToInsert.some(m => m.cell.r === f.r && m.cell.c === f.c)))

      const { error } = await supabase.from('moves').insert(movesToInsert)
      if (error) {
          console.error('Error inserting moves:', error)
          return
      }

      if (hitMine) {
          await supabase.from('games').update({ status: 'finished', winner_id: opponentBoard.owner_id }).eq('id', gameId)
      } else {
          // Because state update is async, we use the local calculated total length
          const currentTotalMoves = myMoves.filter(m => !m.hit_mine).length + movesToInsert.filter(m => !m.hit_mine).length
          const totalNonMines = (boardSize * boardSize) - maxMines
          if (currentTotalMoves >= totalNonMines) {
              await supabase.from('games').update({ status: 'finished', winner_id: userId }).eq('id', gameId)
          }
      }
  }

  if (loading) return (
      <div className="flex flex-1 w-full items-center justify-center bg-brown-50">
          <div className="animate-spin h-8 w-8 border-4 border-amber-600 border-t-transparent rounded-full"></div>
      </div>
  )

  const getNumberColor = (num: number) => {
      const colors = ['text-transparent', 'text-blue-500', 'text-orange-500', 'text-rose-500', 'text-purple-500', 'text-amber-500', 'text-cyan-500', 'text-zinc-800', 'text-zinc-500']
      return colors[num] || 'text-zinc-800'
  }

  return (
    <div className="flex flex-1 w-full flex-col items-center justify-center p-6 bg-gradient-to-br from-brown-50 to-brown-200">
      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center lg:items-start pt-4 pb-20">

        {/* Opponent's Board (The one I click) */}
        <div className="flex flex-col items-center gap-6 bg-white p-8 rounded-3xl shadow-xl border border-brown-100 order-first lg:order-last">
            <div className="text-center">
                <h2 className="text-3xl font-extrabold text-brown-800">Attack Board</h2>
                <p className="text-brown-500 mt-2">Find safe zones. Avoid the mines!</p>
            </div>

            <div
                className="mine-grid shadow-lg"
                style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
            >
                {Array.from({ length: boardSize }).map((_, r) => (
                Array.from({ length: boardSize }).map((_, c) => {
                    const move = myMoves.find(m => m.cell.r === r && m.cell.c === c)
                    const isRevealed = !!move
                    const hitMine = move?.hit_mine
                    const adjacentMines = isRevealed && !hitMine ? calculateAdjacentMines(r, c, opponentBoard) : 0
                    const isFlagged = flags.some(f => f.r === r && f.c === c)

                    return (
                    <button
                        key={`opp-${r}-${c}`}
                        {...useLongPress(
                            (e) => toggleFlag(e, r, c),
                            () => handleCellClick(r, c)
                        )}
                        disabled={isRevealed}
                        className={`mine-cell w-10 h-10 sm:w-12 sm:h-12 text-xl font-black flex items-center justify-center
                        ${!isRevealed ? 'bg-amber-50 hover:bg-amber-200 cursor-pointer shadow-sm hover:shadow active:scale-95'
                          : hitMine ? 'bg-rose-500 shadow-inner'
                          : 'bg-brown-100 shadow-inner'}
                        `}
                    >
                        {hitMine && '💥'}
                        {!isRevealed && isFlagged && '🚩'}
                        {isRevealed && !hitMine && adjacentMines > 0 && (
                            <span className={getNumberColor(adjacentMines)}>{adjacentMines}</span>
                        )}
                    </button>
                    )
                })
                ))}
            </div>

            <div className="bg-brown-50 px-6 py-3 rounded-2xl border border-brown-200 flex flex-col items-center shadow-inner w-full">
                <div className="text-sm text-brown-500 font-bold uppercase tracking-wider mb-1">Progress</div>
                <div className="text-2xl font-mono font-bold text-amber-600">
                    {myMoves.filter(m => !m.hit_mine).length} <span className="text-brown-400">/</span> {(boardSize * boardSize) - maxMines}
                </div>
            </div>
        </div>

        {/* My Board (Mini map to watch opponent) */}
        <div className="hidden lg:flex flex-col items-center gap-6 bg-white/60 p-8 rounded-3xl border border-brown-200 order-last lg:order-first">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-brown-700">Your Defenses</h2>
                <p className="text-sm text-brown-500 mt-1">Watch your opponent's progress</p>
            </div>

            <div
                className="mine-grid opacity-90"
                style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
            >
                {Array.from({ length: boardSize }).map((_, r) => (
                Array.from({ length: boardSize }).map((_, c) => {
                    const isMine = myBoard?.mine_positions.some((m: any) => m.r === r && m.c === c)
                    const oppMove = opponentMoves.find(m => m.cell.r === r && m.cell.c === c)
                    const oppRevealed = !!oppMove
                    const oppHitMine = oppMove?.hit_mine

                    return (
                    <div
                        key={`my-${r}-${c}`}
                        className={`mine-cell w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-sm flex items-center justify-center
                        ${oppHitMine ? 'bg-rose-500 text-white'
                          : oppRevealed ? 'bg-brown-100'
                          : isMine ? 'bg-brown-400'
                          : 'bg-brown-300'}
                        `}
                    >
                        {isMine && !oppRevealed && '💣'}
                        {oppHitMine && '💥'}
                        {oppRevealed && !oppHitMine && <span className="text-orange-500 font-bold">✓</span>}
                    </div>
                    )
                })
                ))}
            </div>

            <div className="bg-brown-50/80 px-6 py-3 rounded-2xl border border-brown-200 flex flex-col items-center w-full">
                <div className="text-xs text-brown-500 font-bold uppercase tracking-wider mb-1">Opponent Progress</div>
                <div className="text-lg font-mono font-bold text-brown-700">
                    {opponentMoves.filter(m => !m.hit_mine).length} <span className="text-brown-400">/</span> {(boardSize * boardSize) - maxMines}
                </div>
            </div>
        </div>

      </div>
    </div>
  )
}
