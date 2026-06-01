import { createClient } from '@supabase/supabase-js'

const FALLBACK_URL      = 'https://epekjmfmbgwfonjyhklm.supabase.co'
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZWtqbWZtYmd3Zm9uanloa2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzQzMzEsImV4cCI6MjA5MDExMDMzMX0.eF0tO2tfGBDt2JkkMl0TeWs7sedba2GabNPXPFFmFkM'

export const SUPABASE_URL      = (import.meta.env.VITE_SUPABASE_URL      as string | undefined) || FALLBACK_URL
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY

// When OAuth callback lands with ?code=, clear old session so
// initializePromise completes instantly without trying to refresh it
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('code')) {
  localStorage.removeItem('sb-epekjmfmbgwfonjyhklm-auth-token')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage          : typeof window !== 'undefined' ? window.localStorage : undefined,
    detectSessionInUrl: true,   // SDK exchanges the code automatically
    flowType         : 'pkce',
    persistSession   : true,
    autoRefreshToken : true,
  },
})
