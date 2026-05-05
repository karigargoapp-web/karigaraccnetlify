import { supabase } from './supabase'
import type { UserRole } from '../types'

const VERIFY_EMAIL_MSG =
  'Please verify your email first. Check your inbox for the confirmation link, or use Resend below.'

/** True if this auth user signed up with email/password (not OAuth-only). */
function hasEmailPasswordIdentity(user: { identities?: { provider: string }[] | null }): boolean {
  return !!user.identities?.some(i => i.provider === 'email')
}

/**
 * After password sign-in (or when enforcing policy), require a confirmed email for
 * email/password accounts. OAuth users typically have `email_confirmed_at` set by Supabase.
 */
export async function assertEmailConfirmed(): Promise<{ ok: true } | { ok: false; message: string }> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) {
    await supabase.auth.signOut({ scope: 'local' })
    return { ok: false, message: 'Could not verify your session. Try again.' }
  }

  if (user.email_confirmed_at) return { ok: true }

  if (hasEmailPasswordIdentity(user)) {
    await supabase.auth.signOut({ scope: 'local' })
    return { ok: false, message: VERIFY_EMAIL_MSG }
  }

  return { ok: true }
}

/**
 * Called on app load: block sessions where email/password signup never confirmed.
 * Does not sign out OAuth-only accounts missing the field (edge case).
 */
export async function signOutIfEmailPasswordUnconfirmed(supaUser: {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
  identities?: { provider: string }[] | null
}): Promise<boolean> {
  if (supaUser.email_confirmed_at) return false
  if (!hasEmailPasswordIdentity(supaUser)) return false
  await supabase.auth.signOut({ scope: 'local' })
  return true
}

/**
 * After email/password sign-in, ensure `public.users.role` matches the login page
 * (customer vs worker). Signs out and returns an error message if it does not.
 */
export async function assertPortalRole(
  portal: 'customer' | 'worker',
): Promise<{ ok: true } | { ok: false; message: string }> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) {
    await supabase.auth.signOut({ scope: 'local' })
    return { ok: false, message: 'Could not verify your session. Try again.' }
  }

  const { data, error } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()

  if (error || !data) {
    await supabase.auth.signOut({ scope: 'local' })
    return { ok: false, message: 'No profile found for this account. Contact support or sign up again.' }
  }

  const role = data.role as UserRole
  if (role === portal) return { ok: true }

  await supabase.auth.signOut({ scope: 'local' })

  if (portal === 'customer') {
    if (role === 'worker') {
      return {
        ok: false,
        message: 'This email is registered as a worker. Use the worker login page.',
      }
    }
    if (role === 'admin') {
      return {
        ok: false,
        message: 'This account is an admin. Open the admin app to sign in.',
      }
    }
  }

  if (portal === 'worker') {
    if (role === 'customer') {
      return {
        ok: false,
        message: 'This email is registered as a customer. Use the customer login page.',
      }
    }
    if (role === 'admin') {
      return {
        ok: false,
        message: 'This account is an admin. Open the admin app to sign in.',
      }
    }
  }

  return { ok: false, message: 'This account cannot sign in on this page.' }
}
