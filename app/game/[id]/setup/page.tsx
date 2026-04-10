'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getSession } from '../../../lib/supabase'
import { useGamePresence } from '../../../lib/useGamePresence'

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
           if (payload.new.status === 'finished') {
               router.push(`/game/${gameId}/result`)
           }
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

  const forfeitGame = async () => {
    if (!userId || !game) return
    if (confirm('Are you sure you want to leave? Your opponent will win.')) {
      const winnerId = game.player1_id === userId ? game.player2_id : game.player1_id
      await supabase.from('games').update({ status: 'finished', winner_id: winnerId }).eq('id', gameId); router.push('/');
    }
  }

  if (isWaiting) {
    return (
      <div className="flex flex-1 w-full flex-col items-center justify-center p-6  from-transparent to-transparent">
        <div className="bg-brown-800 border-brown-700 p-10 rounded-3xl shadow-xl max-w-md w-full text-center border border-brown-700 flex flex-col items-center gap-6">
            <div className="bg-brown-900/50 text-pink-400 p-4 rounded-full">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-3xl font-bold text-pink-100">Board Submitted!</h2>
            <div className="flex items-center gap-3">
                <div className="animate-spin h-5 w-5 border-2 border-pink-500 border-t-transparent rounded-full"></div>
                <p className="text-pink-200/80 font-medium">Waiting for opponent...</p>
            </div>
            {!isOpponentOnline && game?.player2_id && (
              <div className="mt-2 bg-rose-50 text-rose-700 px-4 py-2 text-sm rounded-xl border border-rose-200 w-full text-center">
                Opponent seems to be offline.
              </div>
            )}
            <button
              onClick={forfeitGame}
              className="mt-4 text-pink-300/60 hover:text-rose-600 font-medium transition-colors hover:underline text-sm"
            >
              Leave Game
            </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 w-full flex-col items-center justify-center p-6  from-transparent to-transparent">
      <div className="max-w-2xl w-full flex flex-col gap-8 bg-brown-800 border-brown-700 p-8 sm:p-12 rounded-3xl shadow-xl border border-brown-700">
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-extrabold text-pink-100">Setup Your Board</h2>
          <p className="text-lg text-pink-200/80">
            Place your mines. Your opponent will have to navigate this minefield!
          </p>
          <div className="pt-4 flex justify-center items-center gap-4">
              <div className="bg-brown-700 border border-brown-600/50 shadow-inner px-6 py-3 rounded-2xl font-mono font-bold text-xl flex items-center gap-3 shadow-inner">
                  <span>Mines:</span>
                  <span className={`px-3 py-1 rounded-xl ${mines.length === maxMines ? 'bg-brown-900/50 text-pink-400' : 'bg-pink-200 text-pink-900'}`}>
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
                      ${isMine ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/50' : 'bg-brown-900/50 hover:bg-brown-200'}
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
             className="px-10 py-4 bg-pink-400 text-brown-900 text-lg rounded-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pink-500 border border-pink-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-all shadow-[0_4px_0_theme(colors.pink.600)] active:shadow-[0_0px_0_theme(colors.pink.600)] active:translate-y-[4px] uppercase tracking-wider"
           >
             {isSubmitting ? 'Submitting...' : 'Ready For Battle!'}
           </button>
        </div>

        <div className="mt-8 pt-6 border-t border-brown-700/50 flex flex-col items-center gap-4">
            {!isOpponentOnline && game?.player2_id && (
              <div className="bg-rose-50 text-rose-700 px-4 py-3 rounded-xl border border-rose-200 w-full text-center flex items-center justify-center gap-2">
                <span className="text-xl">⚠️</span>
                <span className="font-medium">Opponent is currently offline.</span>
              </div>
            )}
            <button
              onClick={forfeitGame}
              className="text-pink-300/60 hover:text-rose-600 font-medium transition-colors hover:underline text-sm"
            >
              Leave Game
            </button>
        </div>
      </div>
    </div>
  )
}
