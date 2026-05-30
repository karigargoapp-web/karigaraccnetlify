import { App, type URLOpenListenerEvent } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import toast from 'react-hot-toast'

export const NATIVE_REDIRECT = 'karigargo://login'
const VERIFIER_KEY = 'sb-epekjmfmbgwfonjyhklm-auth-token-code-verifier'
const VERIFIER_BACKUP = 'karigargo-pkce-backup'

export function setupNativeAuthListener() {
  if (!Capacitor.isNativePlatform()) return

  App.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
    const url = event.url
    try { await Browser.close() } catch {}
    if (!url) return

    try {
      // Restore code_verifier from backup — Supabase deletes it during INITIAL_SESSION
      const backup = localStorage.getItem(VERIFIER_BACKUP)
      if (backup) {
        localStorage.setItem(VERIFIER_KEY, backup)
        localStorage.removeItem(VERIFIER_BACKUP)
      }

      // Server always returns PKCE code: karigargo://login?code=xxx
      const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : ''
      if (queryPart) {
        const params = new URLSearchParams(queryPart)
        const code = params.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) toast.error('Sign-in failed: ' + error.message)
          return
        }
      }

      // Fallback: implicit tokens in hash
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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: NATIVE_REDIRECT,
      skipBrowserRedirect: true,
    },
  })

  if (error) throw error
  if (!data.url) throw new Error('No OAuth URL returned')

  // Backup the code_verifier — Supabase deletes it during INITIAL_SESSION
  // when the app resumes and React re-mounts
  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (verifier) {
    localStorage.setItem(VERIFIER_BACKUP, verifier)
  }

  await Browser.open({ url: data.url })
}
