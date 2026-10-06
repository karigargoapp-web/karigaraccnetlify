import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const SUPPORT_INBOX = 'karigargoapp@gmail.com'
const APP_URL = 'https://karigargo.netlify.app'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const FIELD_LABELS: Record<string, string> = {
  photo: 'Profile photo',
  name: 'Full name',
  phone: 'Phone number',
  city: 'City',
  skills: 'Skills',
  cnic: 'CNIC number',
  cnic_front: 'CNIC front image',
  cnic_back: 'CNIC back image',
}

type MailResult = { ok: boolean; error?: string }

async function sendMail(opts: { to: string; subject: string; html: string; replyTo?: string }): Promise<MailResult> {
  const gmailPass = Deno.env.get('GMAIL_APP_PASSWORD')
  if (gmailPass) {
    const user = Deno.env.get('GMAIL_USER') || SUPPORT_INBOX
    const client = new SMTPClient({
      connection: { hostname: 'smtp.gmail.com', port: 465, tls: true, auth: { username: user, password: gmailPass.replace(/\s+/g, '') } },
    })
    try {
      await client.send({
        from: `KarigarGo <${user}>`,
        to: opts.to,
        ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
        subject: opts.subject,
        content: 'Please view this email in an HTML-capable client.',
        html: opts.html,
      })
      return { ok: true }
    } catch (_e) {
      return { ok: false, error: 'smtp_failed' }
    } finally {
      try { await client.close() } catch { /* ignore */ }
    }
  }

  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return { ok: false, error: 'email_not_configured' }
  const from = Deno.env.get('MAIL_FROM') || 'KarigarGo <onboarding@resend.dev>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  })
  if (!res.ok) return { ok: false, error: `mail_failed_${res.status}` }
  return { ok: true }
}

const shell = (inner: string) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#222">
  <div style="background:#006600;color:#fff;padding:18px 20px;border-radius:12px 12px 0 0;font-size:18px;font-weight:600">KarigarGo</div>
  <div style="border:1px solid #e5e5e5;border-top:0;border-radius:0 0 12px 12px;padding:20px;line-height:1.55;font-size:14px">${inner}</div>
</div>`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') || ''

  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
  const { data: authData, error: authErr } = await asUser.auth.getUser()
  if (authErr || !authData?.user) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(url, service)
  const { data: caller } = await admin.from('users').select('id,name,email,role').eq('id', authData.user.id).maybeSingle()
  if (!caller) return json({ error: 'profile_not_found' }, 403)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  if (body.action === 'support_message') {
    const subject = String(body.subject ?? '').trim().slice(0, 150)
    const message = String(body.message ?? '').trim().slice(0, 4000)
    if (!subject || !message) return json({ error: 'missing_fields' }, 400)

    const { data: row, error: insErr } = await admin.from('support_messages').insert({
      user_id: caller.id, user_name: caller.name, user_email: caller.email, user_role: caller.role, subject, message,
    }).select('id').single()
    if (insErr) return json({ error: 'store_failed' }, 500)

    const mail = await sendMail({
      to: SUPPORT_INBOX,
      replyTo: caller.email,
      subject: `[KarigarGo Support] ${subject}`,
      html: shell(`
        <p style="margin:0 0 12px"><strong>From:</strong> ${esc(caller.name || '')} (${esc(caller.role)})<br>
        <strong>Email:</strong> ${esc(caller.email)}</p>
        <p style="margin:0 0 6px"><strong>${esc(subject)}</strong></p>
        <p style="white-space:pre-wrap;margin:0">${esc(message)}</p>`),
    })
    if (mail.ok) await admin.from('support_messages').update({ emailed: true }).eq('id', row.id)
    return json({ ok: true, emailed: mail.ok })
  }

  if (body.action === 'worker_status') {
    if (caller.role !== 'admin') return json({ error: 'forbidden' }, 403)
    const workerId = String(body.worker_id ?? '')
    const status = body.status === 'approved' ? 'approved' : body.status === 'rejected' ? 'rejected' : null
    if (!workerId || !status) return json({ error: 'missing_fields' }, 400)

    const { data: worker } = await admin.from('users').select('name,email,role').eq('id', workerId).maybeSingle()
    if (!worker || worker.role !== 'worker') return json({ error: 'worker_not_found' }, 404)

    const name = esc(worker.name || 'there')
    let subject: string
    let html: string
    if (status === 'approved') {
      subject = 'Your KarigarGo account is approved'
      html = shell(`
        <p>Hi ${name},</p>
        <p>Good news. Your KarigarGo worker account has been <strong>approved</strong>. You can log in now and start bidding on jobs.</p>
        <p><a href="${APP_URL}/login/worker" style="display:inline-block;background:#006600;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Log in</a></p>`)
    } else {
      const fields = Array.isArray(body.fields) ? (body.fields as string[]).filter(f => f in FIELD_LABELS) : []
      const list = fields.length
        ? `<p>Please correct the following:</p><ul>${fields.map(f => `<li>${FIELD_LABELS[f]}</li>`).join('')}</ul>`
        : ''
      subject = 'Your KarigarGo account needs changes'
      html = shell(`
        <p>Hi ${name},</p>
        <p>Your KarigarGo worker account could not be approved yet.</p>
        ${list}
        <p>Log in and tap <strong>Resubmit documents</strong>. You can only edit the items listed above. Everything else stays as you entered it.</p>
        <p><a href="${APP_URL}/login/worker" style="display:inline-block;background:#006600;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Log in</a></p>`)
    }
    const mail = await sendMail({ to: worker.email, subject, html })
    return json({ ok: true, emailed: mail.ok, error: mail.ok ? undefined : mail.error })
  }

  return json({ error: 'unknown_action' }, 400)
})
