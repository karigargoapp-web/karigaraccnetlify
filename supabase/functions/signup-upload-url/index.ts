import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUCKETS = new Set(['avatars', 'signup-docs'])
const FRESH_MS = 30 * 60 * 1000

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: { user_id?: string; files?: { bucket?: string; path?: string }[] }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const userId = String(body.user_id ?? '')
  const files = Array.isArray(body.files) ? body.files.slice(0, 4) : []
  if (!UUID.test(userId) || files.length === 0) return json({ error: 'invalid_request' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId)
  if (authErr || !authUser?.user) return json({ error: 'unknown_user' }, 404)
  const createdAt = new Date(authUser.user.created_at).getTime()
  if (Date.now() - createdAt > FRESH_MS) return json({ error: 'signup_window_expired' }, 403)

  const { data: profile } = await admin.from('users').select('profile_complete').eq('id', userId).maybeSingle()
  if (profile?.profile_complete) return json({ error: 'already_registered' }, 403)

  const out: { bucket: string; path: string; token: string }[] = []
  for (const f of files) {
    const bucket = String(f.bucket ?? '')
    const path = String(f.path ?? '')
    const okPath = new RegExp(`^(cnic/)?${userId}[A-Za-z0-9_.-]*\\.(jpg|jpeg|png|webp)$`, 'i').test(path)
    if (!BUCKETS.has(bucket) || !okPath) return json({ error: 'invalid_path' }, 400)
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path)
    if (error || !data) return json({ error: 'sign_failed' }, 500)
    out.push({ bucket, path, token: data.token })
  }
  return json({ ok: true, files: out })
})
