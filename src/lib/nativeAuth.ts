import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import toast from 'react-hot-toast'

export const NATIVE_REDIRECT = 'karigargo://login'

export function setupNativeAuthListener() {
  if (!Capacitor.isNativePlatform()) return

  App.addListener('appUrlOpen', async ({ url }: { url: string }) => {
    await Browser.close()
    if (!url) return

    try {
      // Supabase redirects back as:
      // karigargo://login#access_token=...  (if implicit)
      // karigargo://login?code=...          (if PKCE)

      // Check hash fragment first (tokens direct)
      const hashPart = url.includes('#') ? url.split('#')[1] : ''
      if (hashPart) {
        const params = new URLSearchParams(hashPart)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (error) toast.error('Login failed: ' + error.message)
          return
        }
      }

      // Check query string for PKCE code
      const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : ''
      if (queryPart) {
        const params = new URLSearchParams(queryPart)
        const code = params.get('code')
        if (code) {
          // Pass the full URL converted to https so Supabase can parse it
          const fullUrl = url.replace('karigargo://login', 'https://epekjmfmbgwfonjyhklm.supabase.co/auth/v1/callback')
          const { error } = await supabase.auth.exchangeCodeForSession(fullUrl)
          if (error) {
            // Fallback: try with just the normalised URL
            const { error: err2 } = await supabase.auth.exchangeCodeForSession(
              url.replace('karigargo://', 'https://karigargo.app/')
            )
            if (err2) toast.error('Login failed: ' + err2.message)
          }
          return
        }
      }

      toast.error('Login failed: no tokens received')
    } catch (e: any) {
      toast.error('Login error: ' + (e?.message || 'Unknown'))
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

  await Browser.open({ url: data.url })
}
