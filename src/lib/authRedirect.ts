import { Capacitor } from '@capacitor/core'

/**
 * Returns true when running inside the Android/iOS APK.
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Base URL for Supabase auth redirects.
 * - APK: uses the deep-link scheme so the OS routes it back into the app
 * - Web: uses the current origin (production or localhost)
 */
export function getAuthRedirectBase(): string {
  if (isNativeApp()) {
    return 'com.karigargo.app://login'
  }
  const fromEnv = import.meta.env.VITE_SITE_URL as string | undefined
  const trimmed = fromEnv?.trim()
  if (trimmed && /^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, '')
  }
  return typeof window !== 'undefined' ? window.location.origin : ''
}

export function emailRedirect(path: string): string {
  if (isNativeApp()) {
    // For APK, always redirect to the deep-link root so App plugin can catch it
    return 'com.karigargo.app://login'
  }
  const base = getAuthRedirectBase()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}
