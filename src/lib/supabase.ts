import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

const FALLBACK_URL = 'https://epekjmfmbgwfonjyhklm.supabase.co'
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZWtqbWZtYmd3Zm9uanloa2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzQzMzEsImV4cCI6MjA5MDExMDMzMX0.eF0tO2tfGBDt2JkkMl0TeWs7sedba2GabNPXPFFmFkM'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY

const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      // Always use localStorage — survives APK backgrounding and browser context switches
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      // On native: we handle URL manually via appUrlOpen, don't let Supabase touch the URL
      detectSessionInUrl: !isNative,
      // PKCE on both — localStorage ensures verifier survives the external browser round-trip
      flowType: 'pkce',
      persistSession: true,
    },
  }
)
