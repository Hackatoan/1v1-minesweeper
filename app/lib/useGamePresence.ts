'use client'
import { useEffect, useState } from 'react'
import { getPlayerId } from './session'
import { pingGame } from './api-client'
import { Game } from './types'

// Returns array of user IDs currently online (pinged within 15s)
export function useGamePresence(gameId: string, game: Game | null) {
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

  // Can't be a useMemo: it needs Date.now() (impure — depends on wall-clock
  // time, not just game.player_pings) to decide the 15s cutoff, and impure
  // calls aren't allowed during render. An effect is the correct place for
  // this kind of "derived from an input plus the current time" computation.
  useEffect(() => {
    if (!game?.player_pings) return
    const cutoff = Date.now() - 15000
    const online = Object.entries(game.player_pings)
      .filter(([, ts]) => new Date(ts).getTime() > cutoff)
      .map(([uid]) => uid)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnlineUsers(online)
  }, [game?.player_pings])

  return onlineUsers
}
