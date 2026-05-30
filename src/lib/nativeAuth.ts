import { App, type URLOpenListenerEvent } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import toast from 'react-hot-toast'

export const NATIVE_REDIRECT = 'karigargo://login'

export function setupNativeAuthListener() {
  if (!Capacitor.isNativePlatform()) return

  App.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
    const url = event.url
    try { await Browser.close() } catch {}
    if (!url) return

    try {
      // Server always returns PKCE code: karigargo://login?code=xxx
      const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : ''
      if (queryPart) {
        const params = new URLSearchParams(queryPart)
        const code = params.get('code')
        if (code) {
          // code_verifier was stored in localStorage by signInWithOAuth (PKCE flow)
          // It survives Chrome Custom Tab because localStorage persists
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            toast.error('Sign-in failed: ' + error.message)
            return
          }
          // Session is now active — onAuthStateChange will fire SIGNED_IN
          // which triggers fetchUserProfile → setUser → router navigates
          return
        }
      }

      // Fallback: implicit tokens in hash (shouldn't happen but handle anyway)
      const hashPart = url.includes('#') ? url.split('#')[1] : ''
      if (hashPart) {
        const params = new URLSearchParams(hashPart)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) toast.error('Sign-in failed: ' + error.message)
        }
      }
    } catch (e: any) {
      toast.error('Sign-in error: ' + (e?.message || 'Unknown'))
    }
  })
}

export async function signInWithGoogleNative(intendedRole: 'customer' | 'worker' = 'customer') {
  localStorage.setItem('oauth-intended-role', intendedRole)

  // PKCE flow: SDK generates code_verifier and stores in localStorage
  // Then generates OAuth URL with code_challenge
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: NATIVE_REDIRECT,
      skipBrowserRedirect: true,
    },
  })

  if (error) throw error
  if (!data.url) throw new Error('No OAuth URL returned')

  // Open Chrome Custom Tab — localStorage (with code_verifier) persists in background
  await Browser.open({ url: data.url })
}
