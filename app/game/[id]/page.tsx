'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase, getSession } from '../../lib/supabase'
import { copyToClipboard } from '../../lib/clipboard'

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
           const { data: updatedGame, error: updateError } = await supabase
            .from('games')
            .update({ player2_id: uid, status: 'setup' })
            .eq('id', gameId)
            .is('player2_id', null)
            .select()
            .single()

           if (updateError) {
             console.error('Update error or game is full:', updateError)
             alert('Failed to join or game is already full.')
             router.push('/')
             return
           }

           setGame(updatedGame)
        } else if (gameData.player1_id !== uid && gameData.player2_id !== uid) {
           // I am a 3rd person
           alert('Game is already full.')
           router.push('/')
           return
        }

        // Subscribe to changes
        subscription = supabase
          .channel(`game-${gameId}-${Math.random()}`)
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

  // Polling fallback
  useEffect(() => {
    if (!game || game.status !== 'waiting') return
    const interval = setInterval(async () => {
      const { data } = await supabase.from('games').select('status, player2_id').eq('id', gameId).single()
      if (data && data.status !== 'waiting') {
        setGame((prev: any) => ({ ...prev, ...data }))
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [game?.status, gameId])

  // Heartbeat for host in waiting room
  useEffect(() => {
    if (!game || game.status !== 'waiting' || game.player1_id !== userId) return

    const ping = async () => {
      await supabase.from('games').update({ last_ping: new Date().toISOString() }).eq('id', gameId)
    }

    ping() // Initial ping
    const interval = setInterval(ping, 5000)
    return () => clearInterval(interval)
  }, [game?.status, game?.player1_id, userId, gameId])

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
      <div className="flex flex-1 w-full items-center justify-center bg-brown-900/50">
          <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full"></div>
      </div>
  )

  if (!game) return <div className="p-8 text-center text-pink-200/80">Game not found</div>

  const isPlayer1 = game.player1_id === userId
  const inviteLink = typeof window !== 'undefined' ? window.location.href : ''

  const copyLink = () => {
      copyToClipboard(inviteLink, setCopied)
  }

  return (
    <div className="flex flex-1 w-full flex-col items-center justify-center p-6 from-transparent to-transparent">
      <div className="bg-brown-800 border-brown-700 p-10 rounded-3xl shadow-xl max-w-md w-full flex flex-col gap-8 text-center border">
        <h2 className="text-3xl font-extrabold text-pink-100">Game Lobby</h2>

        {isPlayer1 && !game.player2_id ? (
          <div className="flex flex-col gap-6">
            <div className="flex justify-center">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-pink-500"></span>
                </span>
            </div>
            <p className="text-pink-200/80 font-medium">Waiting for an opponent to join...</p>
            <div className="bg-brown-900/50 p-4 rounded-xl break-all text-sm font-mono text-pink-300/80 border border-brown-700/50 shadow-inner">
              {inviteLink}
            </div>
            <button
              onClick={copyLink}
              className={`px-6 py-3 rounded-xl font-bold transition-all shadow-md transform hover:-translate-y-0.5 ${
                  copied
                  ? 'bg-pink-500 text-white shadow-[0_4px_0_theme(colors.pink.700)] active:shadow-[0_0px_0_theme(colors.pink.700)] active:translate-y-[4px]'
                  : 'bg-pink-400 text-pink-900 hover:bg-pink-500 shadow-[0_4px_0_theme(colors.pink.600)] active:shadow-[0_0px_0_theme(colors.pink.600)] active:translate-y-[4px]'
              }`}
            >
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 items-center">
            <div className="animate-spin h-8 w-8 border-4 border-pink-500 border-t-transparent rounded-full"></div>
            <p className="text-pink-200/80 font-medium text-lg">Starting game...</p>
          </div>
        )}
      </div>
    </div>
  )
}
