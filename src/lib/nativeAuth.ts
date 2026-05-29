import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import toast from 'react-hot-toast'

export const NATIVE_REDIRECT = 'karigargo://login'

export function setupNativeAuthListener() {
  if (!Capacitor.isNativePlatform()) return

  App.addListener('appUrlOpen', async ({ url }: { url: string }) => {
    toast('🔗 Deep link received', { duration: 4000 })
    await Browser.close()

    if (!url) {
      toast.error('❌ No URL in deep link')
      return
    }

    toast(`📦 URL: ${url.substring(0, 60)}`, { duration: 6000 })

    try {
      const hashPart = url.includes('#') ? url.split('#')[1] : ''
      const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : ''

      if (hashPart) {
        const params = new URLSearchParams(hashPart)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          toast('🔑 Setting session from hash tokens...', { duration: 3000 })
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) toast.error('❌ setSession: ' + error.message)
          else toast.success('✅ Session set!')
          return
        }
      }

      if (queryPart) {
        const params = new URLSearchParams(queryPart)
        const code = params.get('code')
        if (code) {
          toast(`🔄 Exchanging PKCE code...`, { duration: 3000 })
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) toast.error('❌ exchangeCode: ' + error.message)
          else toast.success('✅ Code exchanged! User: ' + data?.user?.email)
          return
        }
      }

      toast.error('❌ No tokens or code found in URL')
    } catch (e: any) {
      toast.error('❌ Error: ' + (e?.message || 'Unknown'))
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
