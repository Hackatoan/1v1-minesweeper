'use client'

import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthChange, signInWithGoogle, signOutUser, claimNickname } from '../lib/firebase'
import { getPlayerName } from '../lib/session'

// Optional Google sign-in so a player's leaderboard stats follow their
// account across devices/browsers instead of resetting with every new
// nickname. Mounted directly into the existing card layout (see
// LandingClient) rather than a floating overlay, using the same
// pink/brown Tailwind classes the rest of the page already uses -- it
// should read as part of the site, not a widget bolted on top.
export function AccountWidget() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [linked, setLinked] = useState<string | null>(null)

  useEffect(() => {
    const CLAIMED_KEY = 'hk_claim_offered'
    // Belt-and-suspenders: onAuthStateChanged normally fires almost
    // instantly (even before any network round-trip, from cached local
    // state), but nothing guarantees it ever fires -- a flaky connection to
    // Firebase, or any other stall inside the SDK, would otherwise leave
    // `ready` false and this whole widget permanently invisible with no
    // visible error. Fail open after a few seconds: show the sign-in button
    // treating the user as signed-out rather than hang forever.
    const failOpen = setTimeout(() => setReady(true), 4000)
    let unsubscribe: (() => void) | undefined
    try {
      unsubscribe = onAuthChange(async (u) => {
        clearTimeout(failOpen)
        setUser(u)
        setReady(true)
        if (!u) return
        const nickname = getPlayerName()
        const offeredFor = localStorage.getItem(CLAIMED_KEY)
        if (!nickname || nickname === offeredFor) return
        const result = await claimNickname(nickname)
        localStorage.setItem(CLAIMED_KEY, nickname)
        if (result.ok) setLinked(nickname)
      })
    } catch (e) {
      console.error('[AccountWidget] failed to subscribe to auth state', e)
      clearTimeout(failOpen)
      setReady(true)
    }
    return () => {
      clearTimeout(failOpen)
      unsubscribe?.()
    }
  }, [])

  async function handleSignIn() {
    setErr('')
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    setBusy(true)
    try {
      await signOutUser()
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return null

  return (
    <div className="flex flex-col items-center gap-1 text-sm w-full">
      {user ? (
        <div className="flex items-center gap-2 text-pink-200/80">
          <span>Signed in as {user.displayName || user.email}</span>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={busy}
            className="underline hover:text-pink-200 disabled:opacity-60"
          >
            Sign out
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="px-4 py-1.5 rounded-lg bg-brown-700 text-pink-300 border border-brown-600/60 font-bold uppercase tracking-wider text-xs hover:bg-brown-600 hover:text-pink-200 disabled:opacity-60 transition-all"
        >
          {busy ? 'Signing in…' : 'Sign in with Google to link stats'}
        </button>
      )}
      {linked && <p className="text-pink-300/60 text-xs">Linked your previous &ldquo;{linked}&rdquo; stats to this account.</p>}
      {err && <p className="text-xs text-red-300">{err}</p>}
    </div>
  )
}
