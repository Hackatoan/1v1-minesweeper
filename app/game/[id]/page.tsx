'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getSession } from '../../lib/supabase'

export default function GameLobby() {
  const router = useRouter()
  const params = useParams()
  const gameId = params.id as string
  const [game, setGame] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let subscription: any

    async function init() {
      try {
        const session = await getSession()
        const uid = session?.user.id
        if (!uid) throw new Error('No user session')
        setUserId(uid)

        // Fetch initial game state
        const { data: gameData, error } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single()

        if (error) throw error
        setGame(gameData)

        // If I am not player 1, and there is no player 2, join as player 2
        if (gameData.player1_id !== uid && !gameData.player2_id) {
           const { error: updateError } = await supabase
            .from('games')
            .update({ player2_id: uid, status: 'setup' })
            .eq('id', gameId)

           if (updateError) throw updateError

           setGame({ ...gameData, player2_id: uid, status: 'setup' })
        }

        // Subscribe to changes
        subscription = supabase
          .channel(`game-${gameId}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
            (payload) => {
              setGame(payload.new)
            }
          )
          .subscribe()

      } catch (e) {
        console.error('Error in lobby:', e)
        router.push('/')
      } finally {
        setLoading(false)
      }
    }

    init()

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription)
      }
    }
  }, [gameId, router])

  // Redirect when status changes
  useEffect(() => {
    if (game?.status === 'setup') {
      router.push(`/game/${gameId}/setup`)
    } else if (game?.status === 'playing') {
      router.push(`/game/${gameId}/play`)
    } else if (game?.status === 'finished') {
       router.push(`/game/${gameId}/result`)
    }
  }, [game?.status, gameId, router])

  if (loading) return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
  )

  if (!game) return <div className="p-8 text-center text-slate-600">Game not found</div>

  const isPlayer1 = game.player1_id === userId
  const inviteLink = typeof window !== 'undefined' ? window.location.href : ''

  const copyLink = () => {
      navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-200">
      <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full flex flex-col gap-8 text-center border border-slate-100">
        <h2 className="text-3xl font-extrabold text-slate-800">Game Lobby</h2>

        {isPlayer1 && !game.player2_id ? (
          <div className="flex flex-col gap-6">
            <div className="flex justify-center">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500"></span>
                </span>
            </div>
            <p className="text-slate-600 font-medium">Waiting for an opponent to join...</p>
            <div className="bg-slate-50 p-4 rounded-xl break-all text-sm font-mono text-slate-700 border border-slate-200 shadow-inner">
              {inviteLink}
            </div>
            <button
              onClick={copyLink}
              className={`px-6 py-3 rounded-xl font-bold transition-all shadow-md transform hover:-translate-y-0.5 ${
                  copied
                  ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                  : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 shadow-indigo-500/10'
              }`}
            >
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 items-center">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
            <p className="text-slate-600 font-medium text-lg">Starting game...</p>
          </div>
        )}
      </div>
    </div>
  )
}
