import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper to get or create a pseudo session if anon auth is disabled
export async function getSession() {
  // First try real anon auth
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const { data: signInData, error } = await supabase.auth.signInAnonymously()

    // If real anon auth fails (e.g. disabled in project), fallback to local pseudo user
    if (error) {
        console.warn('Anonymous auth failed or disabled, falling back to local generated user ID')

        // Check local storage for an existing fallback user ID
        if (typeof window !== 'undefined') {
            let fallbackId = localStorage.getItem('minesweeper_fallback_id')
            if (!fallbackId) {
                // Generate a random UUID
                fallbackId = crypto.randomUUID()
                localStorage.setItem('minesweeper_fallback_id', fallbackId)
            }
            return { user: { id: fallbackId } }
        }

        throw error
    }
    return signInData.session
  }

  return session
}
