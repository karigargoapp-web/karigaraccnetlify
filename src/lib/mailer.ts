import { supabase } from './supabase'

export async function invokeMailer(body: Record<string, unknown>): Promise<{ ok: boolean; emailed: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke('karigar-mailer', { body })
    if (error) return { ok: false, emailed: false }
    return { ok: !!data?.ok, emailed: !!data?.emailed }
  } catch {
    return { ok: false, emailed: false }
  }
}
