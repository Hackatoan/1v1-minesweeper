'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getSession } from '../../../lib/supabase'
import { BOARD_SIZE, MAX_MINES } from '../../../lib/constants'
import { calculateAdjacentMines } from '../../../lib/game-logic'

export default function PlayPhase() {
  const router = useRouter()
  const params = useParams()
  const gameId = params.id as string

  const [userId, setUserId] = useState<string | null>(null)
  const [game, setGame] = useState<any>(null)
  const [myBoard, setMyBoard] = useState<any>(null)
  const [opponentBoard, setOpponentBoard] = useState<any>(null)
  const [myMoves, setMyMoves] = useState<any[]>([])
  const [opponentMoves, setOpponentMoves] = useState<any[]>([])
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

  const handleCellClick = async (r: number, c: number) => {
      if (!userId || !opponentBoard) return

      if (myMoves.some(m => m.cell.r === r && m.cell.c === c)) return

      const hitMine = opponentBoard.mine_positions.some((m: any) => m.r === r && m.c === c)

      const newMove = { game_id: gameId, player_id: userId, cell: { r, c }, hit_mine: hitMine }
      setMyMoves(prev => [...prev, newMove])

      const { error } = await supabase.from('moves').insert(newMove)
      if (error) {
          console.error('Error inserting move:', error)
          return
      }

      if (hitMine) {
          await supabase.from('games').update({ status: 'finished', winner_id: opponentBoard.owner_id }).eq('id', gameId)
      } else {
          const totalNonMines = (BOARD_SIZE * BOARD_SIZE) - MAX_MINES
          if (myMoves.filter(m => !m.hit_mine).length + 1 >= totalNonMines) {
              await supabase.from('games').update({ status: 'finished', winner_id: userId }).eq('id', gameId)
          }
      }
  }

  if (loading) return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
  )

  const getNumberColor = (num: number) => {
      const colors = ['text-transparent', 'text-blue-500', 'text-emerald-500', 'text-rose-500', 'text-purple-500', 'text-amber-500', 'text-cyan-500', 'text-zinc-800', 'text-zinc-500']
      return colors[num] || 'text-zinc-800'
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-200">
      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

        {/* Opponent's Board (The one I click) */}
        <div className="flex flex-col items-center gap-6 bg-white p-8 rounded-3xl shadow-xl border border-slate-100 order-first lg:order-last">
            <div className="text-center">
                <h2 className="text-3xl font-extrabold text-slate-800">Attack Board</h2>
                <p className="text-slate-500 mt-2">Find safe zones. Avoid the mines!</p>
            </div>

            <div
                className="mine-grid shadow-lg"
                style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
            >
                {Array.from({ length: BOARD_SIZE }).map((_, r) => (
                Array.from({ length: BOARD_SIZE }).map((_, c) => {
                    const move = myMoves.find(m => m.cell.r === r && m.cell.c === c)
                    const isRevealed = !!move
                    const hitMine = move?.hit_mine
                    const adjacentMines = isRevealed && !hitMine ? calculateAdjacentMines(r, c, opponentBoard) : 0

                    return (
                    <button
                        key={`opp-${r}-${c}`}
                        onClick={() => handleCellClick(r, c)}
                        disabled={isRevealed}
                        className={`mine-cell w-10 sm:w-12 text-xl font-black
                        ${!isRevealed ? 'bg-indigo-50 hover:bg-indigo-200 cursor-pointer shadow-sm hover:shadow active:scale-95'
                          : hitMine ? 'bg-rose-500 shadow-inner'
                          : 'bg-slate-100 shadow-inner'}
                        `}
                    >
                        {hitMine && '💥'}
                        {isRevealed && !hitMine && adjacentMines > 0 && (
                            <span className={getNumberColor(adjacentMines)}>{adjacentMines}</span>
                        )}
                    </button>
                    )
                })
                ))}
            </div>

            <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-200 flex flex-col items-center shadow-inner w-full">
                <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Progress</div>
                <div className="text-2xl font-mono font-bold text-indigo-600">
                    {myMoves.filter(m => !m.hit_mine).length} <span className="text-slate-400">/</span> {(BOARD_SIZE * BOARD_SIZE) - MAX_MINES}
                </div>
            </div>
        </div>

        {/* My Board (Mini map to watch opponent) */}
        <div className="flex flex-col items-center gap-6 bg-white/60 p-8 rounded-3xl border border-slate-200 order-last lg:order-first">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-700">Your Defenses</h2>
                <p className="text-sm text-slate-500 mt-1">Watch your opponent's progress</p>
            </div>

            <div
                className="mine-grid opacity-90"
                style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
            >
                {Array.from({ length: BOARD_SIZE }).map((_, r) => (
                Array.from({ length: BOARD_SIZE }).map((_, c) => {
                    const isMine = myBoard?.mine_positions.some((m: any) => m.r === r && m.c === c)
                    const oppMove = opponentMoves.find(m => m.cell.r === r && m.cell.c === c)
                    const oppRevealed = !!oppMove
                    const oppHitMine = oppMove?.hit_mine

                    return (
                    <div
                        key={`my-${r}-${c}`}
                        className={`mine-cell w-8 sm:w-10 text-sm
                        ${oppHitMine ? 'bg-rose-500 text-white'
                          : oppRevealed ? 'bg-slate-100'
                          : isMine ? 'bg-slate-400'
                          : 'bg-slate-300'}
                        `}
                    >
                        {isMine && !oppRevealed && '💣'}
                        {oppHitMine && '💥'}
                        {oppRevealed && !oppHitMine && <span className="text-emerald-500 font-bold">✓</span>}
                    </div>
                    )
                })
                ))}
            </div>

            <div className="bg-slate-50/80 px-6 py-3 rounded-2xl border border-slate-200 flex flex-col items-center w-full">
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Opponent Progress</div>
                <div className="text-lg font-mono font-bold text-slate-700">
                    {opponentMoves.filter(m => !m.hit_mine).length} <span className="text-slate-400">/</span> {(BOARD_SIZE * BOARD_SIZE) - MAX_MINES}
                </div>
            </div>
        </div>

      </div>
    </div>
  )
}
