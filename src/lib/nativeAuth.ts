import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import toast from 'react-hot-toast'

export const NATIVE_REDIRECT = 'karigargo://login'

// Global ref to force auth re-check from useAuth
let _onSessionReady: (() => void) | null = null
export function registerSessionReadyCallback(fn: () => void) {
  _onSessionReady = fn
}

export function setupNativeAuthListener() {
  if (!Capacitor.isNativePlatform()) return

  App.addListener('appUrlOpen', async ({ url }: { url: string }) => {
    await Browser.close()
    if (!url) return

    try {
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
          if (error) {
            toast.error('Sign-in failed: ' + error.message)
            return
          }
          // Notify useAuth to re-check session immediately
          if (_onSessionReady) _onSessionReady()
          return
        }
      }

      const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : ''
      if (queryPart) {
        const params = new URLSearchParams(queryPart)
        const code = params.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) { toast.error('Sign-in failed: ' + error.message); return }
          if (_onSessionReady) _onSessionReady()
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

  await Browser.open({ url: data.url })
}
