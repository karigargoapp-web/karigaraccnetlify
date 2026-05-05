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
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = async (supaUser: SupaUser) => {
    try {
      const kicked = await signOutIfEmailPasswordUnconfirmed(supaUser)
      if (kicked) {
        setSession(null)
        setUser(null)
        return
      }

      const emailConfirmed = !!supaUser.email_confirmed_at
      const isGoogleUser =
        supaUser.app_metadata?.provider === 'google' ||
        supaUser.identities?.some(i => i.provider === 'google')

      // Extract Google photo early — needed for both new and existing users
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

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', supaUser.id)
        .maybeSingle()

      if (data) {
        // Enforce portal role for BOTH email/password and Google OAuth.
        // The login pages set 'auth-intended-portal' in sessionStorage before any sign-in.
        // Checking it here (inside fetchUserProfile) is race-condition-free because
        // the role check and setUser happen sequentially in the same async call.
        const intendedPortal = sessionStorage.getItem('auth-intended-portal')
        if (intendedPortal) {
          sessionStorage.removeItem('auth-intended-portal')
          if (data.role !== intendedPortal) {
            await supabase.auth.signOut({ scope: 'local' })
            const correctPage = data.role === 'worker' ? 'worker login' : 'customer login'
            sessionStorage.setItem(
              'auth-portal-error',
              `This account is registered as a ${data.role}. Please sign in on the ${correctPage} page.`,
            )
            // Force a full-page redirect so the login component remounts and shows the error toast
            window.location.href = data.role === 'worker' ? '/login/worker' : '/login'
            return
          }
        }

        const updates: Record<string, unknown> = {}
        if (!data.verified && (emailConfirmed || isGoogleUser)) {
          updates.verified = true
          data.verified = true
        }
        // Backfill photo if row exists but photo was never saved
        if (!data.profile_photo_url && photo) {
          updates.profile_photo_url = photo
          data.profile_photo_url = photo
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('users').update(updates).eq('id', supaUser.id)
        }
        setUser(data as AppUser)
        return
      }

      if (!isGoogleUser) return
      const intendedRole = localStorage.getItem('oauth-intended-role')
      localStorage.removeItem('oauth-intended-role')
      const role: UserRole = intendedRole === 'worker' ? 'worker' : 'customer'

      const { error: rpcErr } = await supabase.rpc('handle_signup_user', {
        p_id: supaUser.id,
        p_name: name,
        p_email: supaUser.email || '',
        p_phone: null,
        p_role: role,
        p_city: null,
        p_profile_photo_url: photo,
        p_verified: true,
      })

      if (!rpcErr && role === 'worker') {
        await supabase.rpc('handle_signup_worker_profile', {
          p_user_id: supaUser.id,
          p_skills: [],
          p_bio: null,
          p_cnic: '',
          p_cnic_front_url: '',
          p_cnic_back_url: '',
          p_certificate_urls: null,
        })
      }

      const { data: newData } = await supabase
        .from('users')
        .select('*')
        .eq('id', supaUser.id)
        .maybeSingle()
      if (newData) setUser(newData as AppUser)
    } catch {
      console.error('[KarigarGo] Failed to fetch/create user profile')
    }
  }

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on mount (Supabase v2), which covers
    // both normal load and OAuth callback (hash token). We await fetchUserProfile
    // before clearing loading so no route guard ever sees loading=false with user=null.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // TOKEN_REFRESHED  — silent JWT rotation, no profile change needed
      // PASSWORD_RECOVERY — recovery session; user hasn't logged in yet, don't fetch
      // USER_UPDATED      — fired by updateUser(); acquires the auth lock itself,
      //                     running fetchUserProfile concurrently causes lock-steal errors
      if (
        event === 'TOKEN_REFRESHED' ||
        event === 'PASSWORD_RECOVERY' ||
        event === 'USER_UPDATED'
      ) return

      setSession(session)
      if (session?.user) {
        await fetchUserProfile(session.user)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' })
    setSession(null)
    setUser(null)
  }

  const refreshUser = async () => {
    if (session?.user) await fetchUserProfile(session.user)
  }

  return (
    <AuthContext.Provider
      value={{ session, user, role: user?.role ?? null, loading, signOut, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
