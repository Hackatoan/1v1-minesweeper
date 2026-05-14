'use client'
import { useEffect, useState } from 'react'
import { getPlayerId } from './session'
import { pingGame } from './api-client'

// Returns array of user IDs currently online (pinged within 15s)
export function useGamePresence(gameId: string, game: any | null) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])

  useEffect(() => {
    if (!gameId) return
    const myId = getPlayerId()
    if (!myId) return

    const ping = () => pingGame(gameId)
    ping()
    const interval = setInterval(ping, 5000)
    return () => clearInterval(interval)
  }, [gameId])

  useEffect(() => {
    if (!game?.player_pings) return
    const cutoff = Date.now() - 15000
    const online = Object.entries(game.player_pings as Record<string, string>)
      .filter(([, ts]) => new Date(ts).getTime() > cutoff)
      .map(([uid]) => uid)
    setOnlineUsers(online)
  }, [game?.player_pings])

  return onlineUsers
}
