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
      <div className="flex flex-1 w-full items-center justify-center from-transparent to-transparent">
          <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full"></div>
      </div>
  )

  if (!game || game.status !== 'finished') {
      return (
          <div className="flex flex-1 w-full items-center justify-center from-transparent to-transparent">
             <div className="bg-brown-800 p-8 rounded-2xl shadow-md text-center border border-brown-700">Game is not finished yet.</div>
          </div>
      )
  }

  const didIWin = game.winner_id === userId

  return (
    <div className="flex flex-1 w-full flex-col items-center justify-center p-6 from-transparent to-transparent">
      <div className="bg-brown-800 p-12 sm:p-16 rounded-3xl shadow-2xl max-w-lg w-full flex flex-col gap-10 text-center border border-brown-700 relative overflow-hidden">

        <div className={`absolute top-0 left-0 w-full h-3 ${didIWin ? 'bg-pink-400' : 'bg-rose-500'}`}></div>

        <div className="space-y-4 relative z-10">
            <div className={`text-6xl mb-6 mx-auto w-24 h-24 flex items-center justify-center rounded-full ${didIWin ? 'bg-brown-900/50' : 'bg-brown-900/50'}`}>
                {didIWin ? '🏆' : '💥'}
            </div>
            <h2 className={`text-5xl font-black tracking-tight ${didIWin ? 'text-pink-400' : 'text-rose-400'}`}>
            {didIWin ? 'Victory!' : 'Defeat!'}
            </h2>
            <p className="text-xl text-pink-200/80 leading-relaxed font-medium px-4">
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
              const session = await getSession()
              const uid = session?.user.id
              if (!uid) return

              const { data: newGame, error } = await supabase
                .from('games')
                .insert({
                  id: Math.random().toString(36).substring(2, 8).toUpperCase(),
                  player1_id: uid,
                  player2_id: game.player1_id === uid ? game.player2_id : game.player1_id,
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
            className="px-8 py-4 bg-pink-400 text-brown-900 rounded-2xl font-bold text-lg hover:bg-pink-500 transition-all shadow-[0_4px_0_theme(colors.pink.600)] active:shadow-[0_0px_0_theme(colors.pink.600)] active:translate-y-[4px] relative z-10 uppercase tracking-wider"
        >
          Rematch
        </button>
      </div>
    </div>
  )
}
