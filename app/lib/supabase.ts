import { createClient } from '@supabase/supabase-js'

const supabaseEnvUrl = process.env.NEXT_PUBLIC_SUPABASE_URL! || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || 'placeholder'

// The proxy URL for local/client-side REST calls to bypass adblockers
const supabaseProxyUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/supabase` : supabaseEnvUrl;

export const supabase = createClient(supabaseProxyUrl, supabaseAnonKey)

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Override the realtime URL to use the direct Supabase URL, bypassing the Next.js proxy
    // This is because Next.js rewrites do not support WebSocket (wss://) proxying.
    const wsProto = process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https') ? 'wss' : 'ws';
    const realtimeUrl = `${wsProto}://${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/^https?:\/\//, '')}/realtime/v1/websocket`;

    if ((supabase.realtime as any).socketAdapter?.socket) {
        (supabase.realtime as any).socketAdapter.socket.endPoint = realtimeUrl;
    }
}

// Helper to get or create a session
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const { data: signInData, error } = await supabase.auth.signInAnonymously()

    if (error) {
        throw error
    }
    return signInData.session
  }

  return session
}
