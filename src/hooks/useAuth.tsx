import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { signOutIfEmailPasswordUnconfirmed } from '../lib/authRole'
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase'
import type { User as AppUser, UserRole } from '../types'
import type { User as SupaUser, Session } from '@supabase/supabase-js'

const VERIFIER_KEY = 'sb-epekjmfmbgwfonjyhklm-auth-token-code-verifier'

interface AuthContextType {
  session: Session | null
  user: AppUser | null
  role: UserRole | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function exchangeCodeFromUrl(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  if (!code) return false

  window.history.replaceState({}, '', window.location.pathname)

  const raw = localStorage.getItem(VERIFIER_KEY) || localStorage.getItem('karigargo-pkce-backup') || ''
  const verifier = raw.split('/')[0]
  localStorage.removeItem(VERIFIER_KEY)
  localStorage.removeItem('karigargo-pkce-backup')
  if (!verifier) return false

  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    })
    if (!resp.ok) return false
    const data = await resp.json()
    if (data.access_token && data.refresh_token) {
      // Write directly to localStorage — bypasses SDK initializePromise
      localStorage.setItem('sb-epekjmfmbgwfonjyhklm-auth-token', JSON.stringify(data))
      return true
    }
  } catch {}
  return false
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = async (supaUser: SupaUser) => {
    try {
      const kicked = await signOutIfEmailPasswordUnconfirmed(supaUser)
      if (kicked) { setSession(null); setUser(null); return }

      const isGoogleUser =
        supaUser.app_metadata?.provider === 'google' ||
        supaUser.identities?.some(i => i.provider === 'google')

      const googleIdentity = supaUser.identities?.find(i => i.provider === 'google')
      const photo =
        supaUser.user_metadata?.avatar_url ||
        supaUser.user_metadata?.picture ||
        (googleIdentity?.identity_data as any)?.avatar_url ||
        (googleIdentity?.identity_data as any)?.picture ||
        null

      const name =
        supaUser.user_metadata?.full_name ||
        supaUser.user_metadata?.name ||
        supaUser.email?.split('@')[0] ||
        'User'

      const { data, error: fetchErr } = await supabase
        .from('users').select('*').eq('id', supaUser.id).maybeSingle()
      if (fetchErr) throw fetchErr

      if (data) {
        const intendedPortal = sessionStorage.getItem('auth-intended-portal')
        if (intendedPortal) {
          sessionStorage.removeItem('auth-intended-portal')
          if (data.role !== intendedPortal && data.role !== 'admin') {
            await supabase.auth.signOut({ scope: 'local' })
            sessionStorage.setItem('auth-portal-error',
              `This account is registered as a ${data.role}. Please sign in on the ${data.role === 'worker' ? 'worker' : 'customer'} login page.`)
            window.location.href = data.role === 'worker' ? '/login/worker' : '/login'
            return
          }
        }
        const updates: Record<string, unknown> = {}
        if (!data.verified && (!!supaUser.email_confirmed_at || isGoogleUser)) { updates.verified = true; data.verified = true }
        if (!data.profile_photo_url && photo) { updates.profile_photo_url = photo; data.profile_photo_url = photo }
        if (Object.keys(updates).length > 0) await supabase.from('users').update(updates).eq('id', supaUser.id)
        setUser(data as AppUser)
        return
      }

      if (!isGoogleUser) return

      const intendedRole = localStorage.getItem('oauth-intended-role')
      localStorage.removeItem('oauth-intended-role')
      const role: UserRole = intendedRole === 'worker' ? 'worker' : 'customer'

      const { error: rpcErr } = await supabase.rpc('handle_signup_user', {
        p_id: supaUser.id, p_name: name, p_email: supaUser.email || '',
        p_phone: null, p_role: role, p_city: null,
        p_profile_photo_url: photo, p_verified: true,
      })
      if (rpcErr) throw rpcErr

      if (role === 'worker') {
        await supabase.rpc('handle_signup_worker_profile', {
          p_user_id: supaUser.id, p_skills: [], p_bio: null,
          p_cnic: '', p_cnic_front_url: '', p_cnic_back_url: '', p_certificate_urls: null,
        })
      }

      const { data: newData, error: newFetchErr } = await supabase
        .from('users').select('*').eq('id', supaUser.id).maybeSingle()
      if (newFetchErr) throw newFetchErr
      if (newData) setUser(newData as AppUser)

    } catch {
      setUser(null)
    }
  }

  useEffect(() => {
    let mounted = true

    const init = async () => {
      // Step 1: Exchange OAuth code if present (via REST — no SDK blocking)
      const exchanged = await exchangeCodeFromUrl()

      // Step 2: Get session with timeout — prevents SDK initializePromise hang
      let currentSession: Session | null = null
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ])
        currentSession = result.data.session
      } catch {
        // getSession timed out — try reading directly from localStorage
        try {
          const raw = localStorage.getItem('sb-epekjmfmbgwfonjyhklm-auth-token')
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed?.access_token) {
              await supabase.auth.setSession({
                access_token: parsed.access_token,
                refresh_token: parsed.refresh_token,
              })
              const r = await supabase.auth.getSession()
              currentSession = r.data.session
            }
          }
        } catch {}
      }

      if (!mounted) return
      setSession(currentSession)
      if (currentSession?.user) {
        await fetchUserProfile(currentSession.user)
      } else {
        setUser(null)
      }
      if (mounted) setLoading(false)
    }

    init()

    // Listen for future auth events (manual login, logout, etc)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'INITIAL_SESSION') return
      if (event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY' || event === 'USER_UPDATED') return
      setSession(session)
      if (session?.user) {
        await fetchUserProfile(session.user)
      } else {
        setUser(null)
      }
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    setSession(null)
    setUser(null)
    await supabase.auth.signOut({ scope: 'global' })
    window.location.href = '/login'
  }

  const refreshUser = async () => {
    if (session?.user) await fetchUserProfile(session.user)
  }

  return (
    <AuthContext.Provider value={{ session, user, role: user?.role ?? null, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
