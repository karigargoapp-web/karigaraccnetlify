import { Capacitor } from '@capacitor/core'

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

export function emailRedirect(path: string): string {
  if (isNativeApp()) {
    return 'karigargo://login'
  }
  // Always use current origin — works on Netlify, Vercel, and localhost
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const p = path.startsWith('/') ? path : `/${path}`
  return `${origin}${p}`
}
