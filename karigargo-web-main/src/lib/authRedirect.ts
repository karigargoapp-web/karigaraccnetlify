/**
 * Base URL for Supabase email links (confirm signup, etc.).
 * Defaults to the current browser origin so production signups get production links.
 * Set VITE_SITE_URL in Vercel if you ever need a fixed canonical URL.
 */
export function getAuthRedirectBase(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL as string | undefined
  const trimmed = fromEnv?.trim()
  if (trimmed && /^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/$/, '')
  }
  return typeof window !== 'undefined' ? window.location.origin : ''
}

export function emailRedirect(path: string): string {
  const base = getAuthRedirectBase()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}
