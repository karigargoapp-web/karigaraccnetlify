import { App, type URLOpenListenerEvent } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import toast from 'react-hot-toast'

export const NATIVE_REDIRECT = 'karigargo://login'

const SUPABASE_URL = 'https://epekjmfmbgwfonjyhklm.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZWtqbWZtYmd3Zm9uanloa2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzQzMzEsImV4cCI6MjA5MDExMDMzMX0.eF0tO2tfGBDt2JkkMl0TeWs7sedba2GabNPXPFFmFkM'

export function setupNativeAuthListener() {
  if (!Capacitor.isNativePlatform()) return

  App.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
    const url = event.url
    try { await Browser.close() } catch {}
    if (!url) return

    try {
      const hashPart = url.includes('#') ? url.split('#')[1] : ''
      if (hashPart) {
        const params = new URLSearchParams(hashPart)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          // Force full app restart after session is written to localStorage
          window.location.replace('/')
          return
        }
      }

      const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : ''
      if (queryPart) {
        const params = new URLSearchParams(queryPart)
        const code = params.get('code')
        if (code) {
          await supabase.auth.exchangeCodeForSession(code)
          window.location.replace('/')
          return
        }
      }
    } catch (e: any) {
      toast.error('Sign-in error: ' + (e?.message || 'Unknown'))
    }
  })

  // ALSO: check on app resume if we have a session but are still on login
  App.addListener('appStateChange', async ({ isActive }) => {
    if (!isActive) return
    // App came to foreground — check if session exists but we're stuck on login
    const path = window.location.pathname
    if (path === '/login' || path === '/login/worker' || path === '/') {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        window.location.replace('/')
      }
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
