// Verifies a Firebase Auth ID token WITHOUT the firebase-admin SDK.
// firebase-admin@14+ requires Node >=22; games-db-instance runs Node 20, and
// pulling in the full Admin SDK for one JWT check per request is unnecessary
// weight anyway. This does the same verification Firebase's own client
// libraries describe for manual ID-token checks: fetch Google's public JWKS
// for the securetoken service, verify the RS256 signature, and check the
// standard claims (issuer/audience/expiry). Ported from tic-tac-toe-online's
// verifyFirebaseToken.js (PR #17) to TypeScript.
import { createRemoteJWKSet, jwtVerify } from 'jose'

const PROJECT_ID = 'games-7e2c4'
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
)

export type VerifiedFirebaseUser = {
  uid: string
  email: string
  name: string
}

// Returns the verified claims on success, or null if the token is missing,
// expired, malformed, or not actually for this Firebase project.
export async function verifyFirebaseToken(idToken: unknown): Promise<VerifiedFirebaseUser | null> {
  if (!idToken || typeof idToken !== 'string') return null
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    })
    if (!payload.sub || !payload.email || !payload.email_verified) return null
    return {
      uid: payload.sub,
      email: payload.email as string,
      name: (payload.name as string) || (payload.email as string),
    }
  } catch {
    return null
  }
}
