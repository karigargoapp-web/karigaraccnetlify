import { Capacitor } from '@capacitor/core'

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

export function getAuthRedirectBase(): string {
  if (isNativeApp()) {
    return 'karigargo://login'
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
    return 'karigargo://login'
  }
  const base = getAuthRedirectBase()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}
