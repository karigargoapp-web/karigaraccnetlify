import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

// Simple scheme that Android supports (no dots in scheme)
export const NATIVE_REDIRECT = 'karigargo://login'

export function setupNativeAuthListener() {
  if (!Capacitor.isNativePlatform()) return

  App.addListener('appUrlOpen', async ({ url }: { url: string }) => {
    await Browser.close()

    if (!url) return

    // Parse the deep link URL
    // karigargo://login?code=xxx  (PKCE)
    // karigargo://login#access_token=xxx  (implicit fallback)
    try {
      const parsed = new URL(url.replace('karigargo://', 'https://karigargo.app/'))
      const code = parsed.searchParams.get('code')

      if (code) {
        // PKCE flow — exchange code for session
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) console.error('PKCE exchange error:', error)
        return
      }

      // Implicit flow — hash fragment
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
    } catch (e) {
      console.error('Deep link parse error:', e)
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
