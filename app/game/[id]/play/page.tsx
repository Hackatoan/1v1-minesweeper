'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getSession } from '../../../lib/supabase'

import { useGamePresence } from '../../../lib/useGamePresence'
import { calculateAdjacentMines } from '../../../lib/game-logic'

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
  const [flagMode, setFlagMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const revealedRef = useRef<Set<string>>(new Set())

  const onlineUsers = useGamePresence(gameId, userId)
  const isOpponentOnline = game ? (game.player1_id === userId ? onlineUsers.includes(game.player2_id) : onlineUsers.includes(game.player1_id)) : false

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
                setMyMoves(prev => { if (prev.some(m => m.id === payload.new.id || (m.cell.r === payload.new.cell.r && m.cell.c === payload.new.cell.c))) return prev; return [...prev, payload.new]; })
            } else {
                setOpponentMoves(prev => { if (prev.some(m => m.id === payload.new.id || (m.cell.r === payload.new.cell.r && m.cell.c === payload.new.cell.c))) return prev; return [...prev, payload.new]; })
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

  const toggleFlag = (e: React.MouseEvent | React.TouchEvent | undefined, r: number, c: number) => {
      if (e) e.preventDefault()
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

      const movesToInsertMap = new Map<string, any>()

      if (hitMine) {
          movesToInsertMap.set(`${r},${c}`, { game_id: gameId, player_id: userId, cell: { r, c }, hit_mine: true })
      } else {
          // Flood fill
          const queue = [{r, c}]
          const visited = new Set<string>()
          visited.add(`${r},${c}`)

          while (queue.length > 0) {
              const current = queue.shift()!
              const adjMines = calculateAdjacentMines(current.r, current.c, opponentBoard, boardSize)

              movesToInsertMap.set(`${current.r},${current.c}`, {
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

      const { error } = await supabase.from('moves').insert(movesToInsert)
      if (error) {
          console.error('Error inserting moves:', error)
          return
      }

      if (hitMine) {
          await supabase.from('games').update({ status: 'finished', winner_id: opponentBoard.owner_id }).eq('id', gameId); await supabase.rpc('increment_games_played');
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
              await supabase.from('games').update({ status: 'finished', winner_id: userId }).eq('id', gameId); await supabase.rpc('increment_games_played');
          }
      }
  }

  if (loading) return (
      <div className="flex flex-1 w-full items-center justify-center bg-brown-900/50">
          <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full"></div>
      </div>
  )

  const getNumberColor = (num: number) => {
      const colors = ['text-transparent', 'text-blue-500', 'text-orange-500', 'text-rose-500', 'text-purple-500', 'text-amber-500', 'text-cyan-500', 'text-zinc-800', 'text-zinc-500']
      return colors[num] || 'text-zinc-800'
  }

  const forfeitGame = async () => {
    if (!userId || !game) return
    if (confirm('Are you sure you want to forfeit? Your opponent will win.')) {
      const winnerId = game.player1_id === userId ? game.player2_id : game.player1_id
      await supabase.from('games').update({ status: 'finished', winner_id: winnerId }).eq('id', gameId); await supabase.rpc('increment_games_played'); router.push('/');
    }
  }

  return (
    <div className="flex flex-1 w-full flex-col items-center justify-center p-6  from-transparent to-transparent">
      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center lg:items-start pt-4 pb-20">

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
        <div className="flex flex-col items-center gap-6 bg-brown-800 border-brown-700 p-8 rounded-3xl shadow-xl border border-brown-700 order-first lg:order-last">
            <div className="text-center w-full flex flex-col items-center">
                <h2 className="text-3xl font-extrabold text-pink-100">Attack Board</h2>
                <p className="text-pink-300/60 mt-2">Find safe zones. Avoid the mines!</p>
                <div className="mt-4 flex gap-2 bg-brown-900/50 p-1 rounded-xl shadow-inner border border-brown-700/50">
                    <button
                        onClick={() => setFlagMode(false)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${!flagMode ? 'bg-brown-600 border border-brown-500/50 hover:bg-brown-500 text-white shadow-md' : 'text-pink-300/60 hover:text-brown-700 hover:bg-brown-700 border border-brown-600/50 shadow-inner'}`}
                    >
                        ⛏️ Dig
                    </button>
                    <button
                        onClick={() => setFlagMode(true)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${flagMode ? 'bg-rose-500 text-white shadow-md' : 'text-pink-300/60 hover:text-brown-700 hover:bg-brown-700 border border-brown-600/50 shadow-inner'}`}
                    >
                        🚩 Flag
                    </button>
                </div>
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
                    const adjacentMines = isRevealed && !hitMine ? calculateAdjacentMines(r, c, opponentBoard, boardSize) : 0
                    const isFlagged = flags.some(f => f.r === r && f.c === c)

                    return (
                    <button
                        key={`opp-${r}-${c}`}
                        onClick={(e) => {
                            if (flagMode) {
                                toggleFlag(e, r, c)
                            } else {
                                handleCellClick(r, c)
                            }
                        }}
                        onContextMenu={(e) => toggleFlag(e, r, c)}
                        disabled={isRevealed}
                        className={`mine-cell w-10 h-10 sm:w-12 sm:h-12 text-xl font-black flex items-center justify-center
                        ${!isRevealed ? 'bg-brown-600 border border-brown-500/50 hover:bg-pink-300 cursor-pointer shadow-sm hover:shadow active:scale-95'
                          : hitMine ? 'bg-rose-500 shadow-inner'
                          : 'bg-brown-700 border border-brown-600/50 shadow-inner'}
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

            <div className="bg-brown-900/50 px-6 py-3 rounded-2xl border border-brown-700/50 flex flex-col items-center shadow-inner w-full">
                <div className="text-sm text-pink-300/60 font-bold uppercase tracking-wider mb-1">Progress</div>
                <div className="text-2xl font-mono font-bold text-pink-400">
                    {new Set(myMoves.filter(m => !m.hit_mine).map(m => `${m.cell.r},${m.cell.c}`)).size} <span className="text-brown-400">/</span> {(boardSize * boardSize) - maxMines}
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
                    const isMine = myBoard?.mine_positions.some((m: any) => m.r === r && m.c === c)
                    const oppMove = opponentMoves.find(m => m.cell.r === r && m.cell.c === c)
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
                    {new Set(opponentMoves.filter(m => !m.hit_mine).map(m => `${m.cell.r},${m.cell.c}`)).size} <span className="text-brown-400">/</span> {(boardSize * boardSize) - maxMines}
                </div>
            </div>
        </div>

      </div>
    </div>
  )
}
