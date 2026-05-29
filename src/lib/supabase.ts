import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

const FALLBACK_URL = 'https://epekjmfmbgwfonjyhklm.supabase.co'
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZWtqbWZtYmd3Zm9uanloa2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzQzMzEsImV4cCI6MjA5MDExMDMzMX0.eF0tO2tfGBDt2JkkMl0TeWs7sedba2GabNPXPFFmFkM'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY

const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()

// On native APK: use localStorage (persists across app backgrounding)
// On web: use sessionStorage (per-tab, prevents cross-tab auth conflicts)
const authStorage = typeof window !== 'undefined'
  ? (isNative ? window.localStorage : window.sessionStorage)
  : undefined

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: authStorage,
      detectSessionInUrl: !isNative, // APK handles URL manually via appUrlOpen
      // On native: use implicit flow — tokens come back in hash fragment, no PKCE verifier needed
      // On web: use pkce for security
      flowType: isNative ? 'implicit' : 'pkce',
    },
  }
)
