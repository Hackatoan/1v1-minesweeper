'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getSession } from '../../../lib/supabase'

// boardSize removed
// maxMines removed

export default function SetupPhase() {
  const router = useRouter()
  const params = useParams()
  const gameId = params.id as string

  const [game, setGame] = useState<any>(null)
  const boardSize = game?.board_size || 10
  const maxMines = Math.floor((boardSize * boardSize) * 0.15)

  const [userId, setUserId] = useState<string | null>(null)
  const [mines, setMines] = useState<{r: number, c: number}[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)

  useEffect(() => {
    let subscription: any

    async function init() {
      const session = await getSession()
      const uid = session?.user.id
      if (!uid) return router.push('/')
      setUserId(uid)

      const { data: gameData } = await supabase.from('games').select('*').eq('id', gameId).single()
      if (!gameData || gameData.status !== 'setup') {
         if(gameData?.status === 'playing') router.push(`/game/${gameId}/play`)
      }
      setGame(gameData)

      const { data: boardData } = await supabase
        .from('boards')
        .select('*')
        .eq('game_id', gameId)
        .eq('owner_id', uid)
        .maybeSingle()

      if (boardData) {
        setIsWaiting(true)
      }

      subscription = supabase
        .channel(`game-setup-${gameId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
           if (payload.new.status === 'playing') {
               router.push(`/game/${gameId}/play`)
           }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'boards', filter: `game_id=eq.${gameId}` }, async () => {
             const { count } = await supabase.from('boards').select('*', { count: 'exact', head: true }).eq('game_id', gameId)
             if (count === 2) {
                 await supabase.from('games').update({ status: 'playing' }).eq('id', gameId)
             }
        })
        .subscribe()
    }

    init()

    return () => {
      if (subscription) supabase.removeChannel(subscription)
    }
  }, [gameId, router])

  const toggleMine = (r: number, c: number) => {
    if (isWaiting) return
    const exists = mines.some(m => m.r === r && m.c === c)
    if (exists) {
      setMines(mines.filter(m => !(m.r === r && m.c === c)))
    } else if (mines.length < maxMines) {
      setMines([...mines, { r, c }])
    }
  }

  const submitBoard = async () => {
    if (mines.length !== maxMines || !userId) return
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('boards').insert({
        game_id: gameId,
        owner_id: userId,
        mine_positions: mines,
        reveal_state: []
      })
      if (error) throw error
      setIsWaiting(true)
    } catch (e) {
      console.error(e)
      alert('Failed to submit board')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isWaiting) {
    return (
      <div className="flex flex-1 w-full flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-200">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100 flex flex-col items-center gap-6">
            <div className="bg-emerald-100 text-emerald-600 p-4 rounded-full">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-3xl font-bold text-slate-800">Board Submitted!</h2>
            <div className="flex items-center gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                <p className="text-slate-600 font-medium">Waiting for opponent...</p>
            </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 w-full flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-200">
      <div className="max-w-2xl w-full flex flex-col gap-8 bg-white p-8 sm:p-12 rounded-3xl shadow-xl border border-slate-100">
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-extrabold text-slate-800">Setup Your Board</h2>
          <p className="text-lg text-slate-600">
            Place your mines. Your opponent will have to navigate this minefield!
          </p>
          <div className="pt-4 flex justify-center items-center gap-4">
              <div className="bg-slate-100 px-6 py-3 rounded-2xl font-mono font-bold text-xl flex items-center gap-3 shadow-inner">
                  <span>Mines:</span>
                  <span className={`px-3 py-1 rounded-xl ${mines.length === maxMines ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {mines.length} / {maxMines}
                  </span>
              </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div
            className="mine-grid"
            style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: boardSize }).map((_, r) => (
              Array.from({ length: boardSize }).map((_, c) => {
                const isMine = mines.some(m => m.r === r && m.c === c)
                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => toggleMine(r, c)}
                    className={`mine-cell w-10 sm:w-12 text-lg sm:text-xl
                      ${isMine ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/50' : 'bg-slate-50 hover:bg-slate-200'}
                    `}
                  >
                    {isMine && '💣'}
                  </button>
                )
              })
            ))}
          </div>
        </div>

        <div className="flex justify-center pt-4">
           <button
             onClick={submitBoard}
             disabled={mines.length !== maxMines || isSubmitting}
             className="px-10 py-4 bg-emerald-500 text-white text-lg rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-600 transition-all shadow-lg hover:shadow-emerald-500/30 transform hover:-translate-y-1"
           >
             {isSubmitting ? 'Submitting...' : 'Ready For Battle!'}
           </button>
        </div>
      </div>
    </div>
  )
}
