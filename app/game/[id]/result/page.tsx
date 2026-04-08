'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getSession } from '../../../lib/supabase'


export default function ResultPhase() {
  const router = useRouter()
  const params = useParams()
  const gameId = params.id as string

  const [userId, setUserId] = useState<string | null>(null)
  const [game, setGame] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let subscription: any
    async function init() {
      const session = await getSession()
      const uid = session?.user.id
      if (!uid) return router.push('/')
      setUserId(uid)

      const { data: gameData } = await supabase.from('games').select('*').eq('id', gameId).single()
      setGame(gameData)
      setLoading(false)

      if (gameData?.rematch_game_id) {
        router.push(`/game/${gameData.rematch_game_id}`)
        return
      }

      subscription = supabase
        .channel(`game-result-${gameId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
          (payload) => {
            if (payload.new.rematch_game_id) {
              router.push(`/game/${payload.new.rematch_game_id}`)
            }
          }
        )
        .subscribe()
    }

    init()

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription)
      }
    }
  }, [gameId, router])

  if (loading) return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
  )

  if (!game || game.status !== 'finished') {
      return (
          <div className="flex min-h-screen items-center justify-center bg-slate-50">
             <div className="bg-white p-8 rounded-2xl shadow-md text-center border border-slate-100">Game is not finished yet.</div>
          </div>
      )
  }

  const didIWin = game.winner_id === userId

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-200">
      <div className="bg-white p-12 sm:p-16 rounded-3xl shadow-2xl max-w-lg w-full flex flex-col gap-10 text-center border border-slate-100 relative overflow-hidden">

        <div className={`absolute top-0 left-0 w-full h-3 ${didIWin ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>

        <div className="space-y-4 relative z-10">
            <div className={`text-6xl mb-6 mx-auto w-24 h-24 flex items-center justify-center rounded-full ${didIWin ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                {didIWin ? '🏆' : '💥'}
            </div>
            <h2 className={`text-5xl font-black tracking-tight ${didIWin ? 'text-emerald-600' : 'text-rose-600'}`}>
            {didIWin ? 'Victory!' : 'Defeat!'}
            </h2>
            <p className="text-xl text-slate-600 leading-relaxed font-medium px-4">
            {didIWin
                ? 'You expertly navigated the minefield while your opponent perished.'
                : 'You hit a mine or were outpaced by your opponent.'}
            </p>
        </div>

        <button
            onClick={async () => {
              if (game.rematch_game_id) {
                router.push(`/game/${game.rematch_game_id}`)
                return
              }
              const { data: newGame, error } = await supabase
                .from('games')
                .insert({
                  player1_id: userId,
                  player2_id: game.player1_id === userId ? game.player2_id : game.player1_id,
                  status: 'setup'
                })
                .select()
                .single()

              if (error) {
                console.error('Failed to create rematch', error)
                return
              }

              await supabase.from('games').update({ rematch_game_id: newGame.id }).eq('id', gameId)
              router.push(`/game/${newGame.id}`)
            }}
            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-1 relative z-10"
        >
          Rematch
        </button>
      </div>
    </div>
  )
}
