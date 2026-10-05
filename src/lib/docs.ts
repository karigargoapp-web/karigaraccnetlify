import { supabase } from './supabase'

const MARKER = '/signup-docs/'

export function signupDocPath(url: string | null | undefined): string | null {
  if (!url) return null
  const i = url.indexOf(MARKER)
  if (i === -1) return null
  return decodeURIComponent(url.slice(i + MARKER.length).split('?')[0])
}

const cache = new Map<string, { url: string; exp: number }>()

export async function signedDocUrl(url: string | null | undefined): Promise<string | null> {
  const path = signupDocPath(url)
  if (!path) return url || null
  const hit = cache.get(path)
  if (hit && hit.exp > Date.now()) return hit.url
  const { data, error } = await supabase.storage.from('signup-docs').createSignedUrl(path, 600)
  if (error || !data) return null
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 540_000 })
  return data.signedUrl
}
