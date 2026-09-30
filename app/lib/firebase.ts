'use client'

// Firebase Auth (Google sign-in) so a player's leaderboard stats can follow
// their account across devices/browsers instead of resetting with every new
// nickname. This config is the public web app config from the Firebase
// console — safe to commit, not a secret (unlike the Admin SDK service
// account key used server-side, never used in this repo at all — see
// verifyFirebaseToken.ts). Mirrors clip-forge's src/firebase.js pattern
// (PR #9), adapted for this app's modular-SDK + Next.js/TypeScript setup.
import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyA_VXg8asalt0D9PItb7JjfDZZ16CZdBlw',
  authDomain: 'games-7e2c4.firebaseapp.com',
  projectId: 'games-7e2c4',
  storageBucket: 'games-7e2c4.firebasestorage.app',
  messagingSenderId: '672139906513',
  appId: '1:672139906513:web:b237739890977bdb1724f0',
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export function signOutUser() {
  return signOut(auth)
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

// api-client.ts needs a synchronous header value on every request, but
// getIdToken() is async (it may silently refresh against Firebase). Keep a
// small cache updated on every auth change / token refresh so headers() can
// just read it. Falls back to null (unauthenticated request) if a fresh
// token isn't in hand yet — never blocks a game action on a network round
// trip to Firebase.
let cachedIdToken: string | null = null

onAuthChange(async (user) => {
  if (!user) {
    cachedIdToken = null
    return
  }
  try {
    cachedIdToken = await user.getIdToken()
  } catch {
    cachedIdToken = null
  }
})

// Refresh the cached token periodically since ID tokens expire hourly and a
// long-lived tab shouldn't silently drop back to anonymous mid-session.
if (typeof window !== 'undefined') {
  setInterval(async () => {
    const user = auth.currentUser
    if (!user) return
    try {
      cachedIdToken = await user.getIdToken()
    } catch {
      cachedIdToken = null
    }
  }, 10 * 60 * 1000)
}

export function getCachedIdToken(): string | null {
  return cachedIdToken
}

export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  cachedIdToken = await user.getIdToken()
  return cachedIdToken
}

export async function claimNickname(nickname: string): Promise<{ ok: boolean; reason?: string }> {
  const idToken = await getIdToken()
  if (!idToken) return { ok: false, reason: 'not signed in' }
  try {
    const res = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, nickname }),
    })
    return await res.json()
  } catch {
    return { ok: false, reason: 'network error' }
  }
}
