import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

export const NATIVE_REDIRECT = 'karigargo://login'

export function setupNativeAuthListener() {
  if (!Capacitor.isNativePlatform()) return

  App.addListener('appUrlOpen', async ({ url }: { url: string }) => {
    await Browser.close()
    if (!url) return

    try {
      // Convert custom scheme to https so URL() can parse it
      // karigargo://login?code=xxx  → https://karigargo.app/login?code=xxx
      const normalised = url.replace('karigargo://', 'https://karigargo.app/')
      const parsed = new URL(normalised)
      const code = parsed.searchParams.get('code')

      if (code) {
        // PKCE: pass the FULL normalised URL so Supabase can find the
        // code_verifier it stored in localStorage during signInWithOAuth
        const { error } = await supabase.auth.exchangeCodeForSession(normalised)
        if (error) {
          console.error('[KarigarGo] PKCE exchange error:', error.message)
        }
        return
      }

      // Implicit / hash flow fallback
      const hash = url.includes('#') ? url.split('#')[1] : ''
      if (hash) {
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) console.error('[KarigarGo] setSession error:', error.message)
        }
      }
    } catch (e) {
      console.error('[KarigarGo] Deep link parse error:', e)
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
