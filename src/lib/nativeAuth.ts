import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

/**
 * Call once at app startup (inside AuthProvider useEffect).
 * Listens for deep links like com.karigargo.app://login#access_token=...
 * and exchanges them for a Supabase session.
 */
export function setupNativeAuthListener() {
  if (!Capacitor.isNativePlatform()) return

  App.addListener('appUrlOpen', async ({ url }) => {
    // Close the in-app browser if it was open
    await Browser.close()

    // Supabase appends the token as a hash fragment or query params
    // e.g. com.karigargo.app://login#access_token=xxx&refresh_token=yyy
    // e.g. com.karigargo.app://login?code=xxx  (PKCE flow)
    if (!url) return

    // Try PKCE code exchange first
    const urlObj = new URL(url.replace('com.karigargo.app://', 'https://karigargo.app/'))
    const code = urlObj.searchParams.get('code')
    if (code) {
      await supabase.auth.exchangeCodeForSession(url)
      return
    }

    // Fallback: implicit flow — hash fragment tokens
    const hash = url.includes('#') ? url.split('#')[1] : ''
    if (hash) {
      const params = new URLSearchParams(hash)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
      }
    }
  })
}

/**
 * Opens Google OAuth using the in-app browser on APK.
 * On web, falls back to normal redirect.
 */
export async function signInWithGoogleNative(intendedRole: 'customer' | 'worker' = 'customer') {
  localStorage.setItem('oauth-intended-role', intendedRole)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'com.karigargo.app://login',
      skipBrowserRedirect: true, // We'll open it manually with Capacitor Browser
    },
  })

  if (error) throw error
  if (!data.url) throw new Error('No OAuth URL returned')

  await Browser.open({ url: data.url })
}
