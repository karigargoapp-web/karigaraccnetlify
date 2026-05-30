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
      // Implicit flow: tokens in hash fragment
      // karigargo://login#access_token=xxx&refresh_token=yyy
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
          return
        }
      }

      // PKCE fallback: code in query params
      const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : ''
      if (queryPart) {
        const params = new URLSearchParams(queryPart)
        const code = params.get('code')
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) toast.error('Sign-in failed: ' + error.message)
          return
        }
      }
    } catch (e: any) {
      toast.error('Sign-in error: ' + (e?.message || 'Unknown'))
    }
  })
}

export async function signInWithGoogleNative(intendedRole: 'customer' | 'worker' = 'customer') {
  localStorage.setItem('oauth-intended-role', intendedRole)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: NATIVE_REDIRECT,
      skipBrowserRedirect: true,
    },
  })

  if (error) throw error
  if (!data.url) throw new Error('No OAuth URL returned')

  // Force implicit flow by stripping PKCE params from URL
  // This makes the server return #access_token instead of ?code
  // No code_verifier needed — tokens come directly
  const oauthUrl = new URL(data.url)
  oauthUrl.searchParams.delete('code_challenge')
  oauthUrl.searchParams.delete('code_challenge_method')

  await Browser.open({ url: oauthUrl.toString() })
}
