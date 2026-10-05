import { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
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

const USER_CACHE_KEY = 'karigargo-user-cache'
const SB_TOKEN_KEY = 'sb-epekjmfmbgwfonjyhklm-auth-token'

function readCachedUser(): AppUser | null {
  try {
    if (!localStorage.getItem(SB_TOKEN_KEY)) return null
    if (new URLSearchParams(window.location.search).has('code')) return null
    const raw = localStorage.getItem(USER_CACHE_KEY)
    return raw ? (JSON.parse(raw) as AppUser) : null
  } catch {
    return null
  }
}

function writeCachedUser(user: AppUser | null) {
  try {
    if (!user) { localStorage.removeItem(USER_CACHE_KEY); return }
    const { cnic: _c, cnic_front_url: _f, cnic_back_url: _b, ...safe } = user as AppUser & { cnic?: unknown; cnic_front_url?: unknown; cnic_back_url?: unknown }
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(safe))
  } catch { /* storage unavailable */ }
}

function roleHome(role: string, approvalStatus?: string) {
  if (role === 'customer') return '/customer/home'
  if (role === 'worker') return approvalStatus === 'approved' ? '/worker/dashboard' : '/worker/pending-approval'
  if (role === 'admin') return '/admin'
  return '/login'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [cached] = useState<AppUser | null>(readCachedUser)
  const [user, setUser]       = useState<AppUser | null>(cached)
  const [loading, setLoading] = useState(cached === null)
  const navigate = useNavigate()
  const navRef = useRef(navigate)
  navRef.current = navigate

  const fetchAndSetUser = useCallback(async (supaUser: SupaUser): Promise<AppUser | null> => {
    try {
      const hasEmailIdentity = !!supaUser.identities?.some((i: any) => i.provider === 'email')
      if (!supaUser.email_confirmed_at && hasEmailIdentity) {
        await supabase.auth.signOut({ scope: 'local' })
        setSession(null); setUser(null)
        return null
      }

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
        setUser(data as AppUser)
        if (Object.keys(updates).length > 0) void supabase.from('users').update(updates).eq('id', supaUser.id)
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

      const [{ data: newData, error: newFetchErr }] = await Promise.all([
        supabase.from('users').select('*').eq('id', supaUser.id).maybeSingle(),
        role === 'worker'
          ? supabase.rpc('handle_signup_worker_profile', {
              p_user_id: supaUser.id, p_skills: [], p_bio: null,
              p_cnic: '', p_cnic_front_url: '', p_cnic_back_url: '', p_certificate_urls: null,
            })
          : Promise.resolve(null),
      ])
      if (newFetchErr) throw newFetchErr
      if (newData) { setUser(newData as AppUser); return newData as AppUser }
      return null

    } catch {
      setUser(null)
      return null
    }
  }, [])

  // Called by nativeAuth after Google OAuth code exchange on APK
  const handleNativeSessionReady = useCallback(async (passed?: Session | null) => {
    const sess = passed ?? (await supabase.auth.getSession()).data.session
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
        navRef.current('/login', { replace: true })
        return
      }
      if (!appUser.profile_complete) {
        navRef.current(appUser.role === 'worker' ? '/complete-profile/worker' : '/complete-profile/customer', { replace: true })
      } else {
        navRef.current(roleHome(appUser.role, appUser.approval_status), { replace: true })
      }
    }
  }, [fetchAndSetUser])

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted) return
      if (event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY' || event === 'USER_UPDATED') return
      if (event === 'INITIAL_SESSION' && code) return
      if (event === 'SIGNED_IN') return

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setLoading(false)
        return
      }

      setTimeout(async () => {
        if (!mounted) return
        setSession(sess)
        if (sess?.user) {
          await fetchAndSetUser(sess.user)
        } else {
          setUser(null)
        }
        if (mounted) setLoading(false)
      }, 0)
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
                navRef.current(appUser.role === 'worker' ? '/complete-profile/worker' : '/complete-profile/customer', { replace: true })
              } else {
                navRef.current(roleHome(appUser.role, appUser.approval_status), { replace: true })
              }
            }
          }
        })
        .catch(() => {
          if (mounted) { setUser(null); setLoading(false) }
        })
    }

    return () => { mounted = false; subscription.unsubscribe() }
  }, [fetchAndSetUser])

  // Called directly by Login.tsx / WorkerLogin.tsx after email/password sign-in
  // Bypasses onAuthStateChange entirely — no async race condition
  useEffect(() => { writeCachedUser(user) }, [user])

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

  const value = useMemo(
    () => ({ session, user, role: user?.role ?? null, loading, signOut, refreshUser, setUserDirectly }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, user, loading],
  )

  return (
    <AuthContext.Provider value={value}>
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
