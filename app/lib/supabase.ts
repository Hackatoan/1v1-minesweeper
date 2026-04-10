import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
