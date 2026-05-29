import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

// Hardcoded fallbacks — anon key is safe to include in client code (it's public by design)
const FALLBACK_URL = 'https://epekjmfmbgwfonjyhklm.supabase.co'
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZWtqbWZtYmd3Zm9uanloa2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzQzMzEsImV4cCI6MjA5MDExMDMzMX0.eF0tO2tfGBDt2JkkMl0TeWs7sedba2GabNPXPFFmFkM'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY

// On native APK: use localStorage so session survives app backgrounding + external browser callbacks.
// On web: use sessionStorage (per-tab) to prevent cross-tab auth conflicts.
const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()
const authStorage = typeof window !== 'undefined'
  ? (isNative ? window.localStorage : window.sessionStorage)
  : undefined

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: authStorage,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
)
