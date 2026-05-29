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
      // Implicit flow: tokens come in hash fragment
      // karigargo://login#access_token=xxx&refresh_token=yyy&token_type=bearer
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
          if (error) {
            toast.error('Sign-in failed: ' + error.message)
          }
          return
        }
      }

      // Fallback: PKCE code in query params (shouldn't happen with implicit flow)
      const normalised = url.replace('karigargo://', 'https://karigargo.app/')
      const parsed = new URL(normalised)
      const code = parsed.searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(normalised)
        if (error) toast.error('Sign-in failed: ' + error.message)
      }

    } catch (e: any) {
      toast.error('Sign-in error: ' + (e?.message || 'Unknown error'))
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
