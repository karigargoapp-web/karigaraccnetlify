import { useState, useEffect, createContext, useContext, ReactNode } from 'react'
import { signOutIfEmailPasswordUnconfirmed } from '../lib/authRole'
import { supabase } from '../lib/supabase'
import type { User as AppUser, UserRole } from '../types'
import type { User as SupaUser, Session } from '@supabase/supabase-js'

interface AuthContextType {
  session: Session | null
  user: AppUser | null
  role: UserRole | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser]       = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = async (supaUser: SupaUser) => {
    try {
      const kicked = await signOutIfEmailPasswordUnconfirmed(supaUser)
      if (kicked) { setSession(null); setUser(null); return }

      const isGoogleUser =
        supaUser.app_metadata?.provider === 'google' ||
        supaUser.identities?.some((i: any) => i.provider === 'google')

      const googleIdentity = supaUser.identities?.find((i: any) => i.provider === 'google')
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
    const code = new URLSearchParams(window.location.search).get('code')

    // Subscribe first so SIGNED_IN from exchange is always caught
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY' || event === 'USER_UPDATED') return

      // If code exchange is pending, skip null INITIAL_SESSION — stay loading
      if (event === 'INITIAL_SESSION' && !session && code) return

      setSession(session)
      if (session?.user) {
        await fetchUserProfile(session.user)
      } else {
        setUser(null)
      }
      if (mounted) setLoading(false)
    })

    if (code) {
      // Clean URL immediately
      window.history.replaceState({}, '', window.location.pathname)
      // Exchange code — initializePromise is fast (no old session, no detectSessionInUrl)
      supabase.auth.exchangeCodeForSession(code)
        .catch(() => {
          // Exchange failed — stop loading, show login
          if (mounted) { setUser(null); setLoading(false) }
        })
      // Success fires SIGNED_IN → handled above
    }

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  const signOut = async () => {
    setSession(null); setUser(null)
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
