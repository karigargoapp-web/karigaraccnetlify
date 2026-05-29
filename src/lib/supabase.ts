import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const missing =
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl.includes('your-project') ||
  supabaseAnonKey === 'your-anon-key'

if (import.meta.env.DEV && missing) {
  console.error(
    '%c[KarigarGo] Supabase env missing or still using placeholders.',
    'color:#c00;font-weight:bold',
    '\n\n1. Copy .env.example → .env.local in the project root (same folder as package.json).',
    '\n2. Open https://supabase.com/dashboard → your project → Settings → API.',
    '\n3. Paste Project URL into VITE_SUPABASE_URL and anon public key into VITE_SUPABASE_ANON_KEY.',
    '\n4. Restart the dev server (npm run dev).\n\n' +
      'Note: If you had keys before, they lived in the old karigargoapp/.env.local folder and were removed when the app was moved to the repo root — add them again here.\n'
  )
}

// On native APK: use localStorage so session survives app backgrounding + external browser callbacks.
// On web: use sessionStorage (per-tab) to prevent cross-tab auth conflicts.
const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()
const authStorage = typeof window !== 'undefined'
  ? (isNative ? window.localStorage : window.sessionStorage)
  : undefined

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.invalid',
  supabaseAnonKey || 'invalid-placeholder-key',
  {
    auth: {
      storage: authStorage,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
)
