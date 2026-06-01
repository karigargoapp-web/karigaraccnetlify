import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { signOutIfEmailPasswordUnconfirmed } from '../lib/authRole'
import { registerSessionReadyCallback } from '../lib/nativeAuth'
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
  setUserDirectly: (user: AppUser, session: Session) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function roleHome(role: string, approvalStatus?: string) {
  if (role === 'customer') return '/customer/home'
  if (role === 'worker') return approvalStatus === 'approved' ? '/worker/dashboard' : '/worker/pending-approval'
  if (role === 'admin') return '/admin'
  return '/login'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser]       = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  const fetchAndSetUser = useCallback(async (supaUser: SupaUser): Promise<AppUser | null> => {
    try {
      const kicked = await signOutIfEmailPasswordUnconfirmed(supaUser)
      if (kicked) { setSession(null); setUser(null); return null }

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
        const updates: Record<string, unknown> = {}
        if (!data.verified && (!!supaUser.email_confirmed_at || isGoogleUser)) { updates.verified = true; data.verified = true }
        if (!data.profile_photo_url && photo) { updates.profile_photo_url = photo; data.profile_photo_url = photo }
        if (Object.keys(updates).length > 0) await supabase.from('users').update(updates).eq('id', supaUser.id)
        setUser(data as AppUser)
        return data as AppUser
      }

      if (!isGoogleUser) return null

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
      if (newData) { setUser(newData as AppUser); return newData as AppUser }
      return null

    } catch {
      setUser(null)
      return null
    }
  }, [])

  // Called by nativeAuth after Google OAuth code exchange on APK
  const handleNativeSessionReady = useCallback(async () => {
    const { data: { session: sess } } = await supabase.auth.getSession()
    if (!sess?.user) return
    setSession(sess)
    const appUser = await fetchAndSetUser(sess.user)
    setLoading(false)
    if (appUser) {
      const intendedPortal = sessionStorage.getItem('auth-intended-portal')
      sessionStorage.removeItem('auth-intended-portal')
      if (appUser.role !== 'customer' && appUser.role !== 'admin' && intendedPortal === 'customer') {
        toast_error('This account is a worker account. Please use the worker login.')
        await supabase.auth.signOut({ scope: 'local' })
        setUser(null); setSession(null)
        nav('/login', { replace: true })
        return
      }
      if (!appUser.profile_complete) {
        nav(appUser.role === 'worker' ? '/complete-profile/worker' : '/complete-profile/customer', { replace: true })
      } else {
        nav(roleHome(appUser.role, appUser.approval_status), { replace: true })
      }
    }
  }, [fetchAndSetUser, nav])

  useEffect(() => {
    // Register callback for native APK Google login
    if (Capacitor.isNativePlatform()) {
      registerSessionReadyCallback(handleNativeSessionReady)
    }
  }, [handleNativeSessionReady])

  useEffect(() => {
    let mounted = true
    const code = new URLSearchParams(window.location.search).get('code')

    // onAuthStateChange handles:
    // 1. INITIAL_SESSION — session restore on page load/refresh
    // 2. OAuth code exchange on web (Google login)
    // 3. SIGNED_OUT — clear state
    // Email/password login: handled directly in Login.tsx via setUserDirectly (no race)
    // APK Google login: handled via registerSessionReadyCallback in nativeAuth.ts
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (!mounted) return
      if (event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY' || event === 'USER_UPDATED') return
      if (event === 'INITIAL_SESSION' && code) return
      // Skip SIGNED_IN on web — handled by login pages directly
      // Skip SIGNED_IN on native — handled by handleNativeSessionReady callback
      if (event === 'SIGNED_IN') return

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        if (mounted) setLoading(false)
        return
      }

      // INITIAL_SESSION only — restore persisted session on page load
      setSession(sess)
      if (sess?.user) {
        await fetchAndSetUser(sess.user)
      } else {
        setUser(null)
      }
      if (mounted) setLoading(false)
    })

    // Web OAuth code exchange (Google login on browser/web)
    if (code) {
      window.history.replaceState({}, '', window.location.pathname)
      supabase.auth.exchangeCodeForSession(code)
        .then(async ({ data, error }) => {
          if (!mounted) return
          if (error || !data.session) {
            setUser(null)
            setLoading(false)
            return
          }
          setSession(data.session)
          const appUser = await fetchAndSetUser(data.session.user)
          if (mounted) {
            setLoading(false)
            if (appUser) {
              if (!appUser.profile_complete) {
                nav(appUser.role === 'worker' ? '/complete-profile/worker' : '/complete-profile/customer', { replace: true })
              } else {
                nav(roleHome(appUser.role, appUser.approval_status), { replace: true })
              }
            }
          }
        })
        .catch(() => {
          if (mounted) { setUser(null); setLoading(false) }
        })
    }

    return () => { mounted = false; subscription.unsubscribe() }
  }, [fetchAndSetUser, nav])

  // Called directly by Login.tsx / WorkerLogin.tsx after email/password sign-in
  // Bypasses onAuthStateChange entirely — no async race condition
  const setUserDirectly = (appUser: AppUser, sess: Session) => {
    setSession(sess)
    setUser(appUser)
    setLoading(false)
  }

  const signOut = async () => {
    setSession(null)
    setUser(null)
    try {
      await supabase.auth.signOut({ scope: 'global' })
    } catch {
      // ignore, still redirect
    }
    window.location.href = '/login'
  }

  const refreshUser = async () => {
    const { data: { session: sess } } = await supabase.auth.getSession()
    if (sess?.user) await fetchAndSetUser(sess.user)
  }

  return (
    <AuthContext.Provider value={{ session, user, role: user?.role ?? null, loading, signOut, refreshUser, setUserDirectly }}>
      {children}
    </AuthContext.Provider>
  )
}

// Lightweight toast for use inside auth (avoids circular imports)
function toast_error(msg: string) {
  try {
    const t = (window as any).__toast_error
    if (t) t(msg)
  } catch {}
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
