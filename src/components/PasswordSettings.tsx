import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoEye, IoEyeOff } from 'react-icons/io5'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PASSWORD_HINT, validatePassword } from '../lib/validation'
import FieldError from './FieldError'
import toast from 'react-hot-toast'

function PasswordInput({ value, onChange, placeholder, hasError }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  hasError?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full pr-10 ${hasError ? 'field-error' : ''}`}
      />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted w-11 h-11 flex items-center justify-center">
        {show ? <IoEyeOff size={18} /> : <IoEye size={18} />}
      </button>
    </div>
  )
}

export default function PasswordSettings({ backTo }: { backTo: string }) {
  const nav = useNavigate()
  const { user, session, refreshUser } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const authUser = session?.user
  const isGoogle = !!authUser?.identities?.some(i => i.provider === 'google')
  const hasEmailIdentity = !!authUser?.identities?.some(i => i.provider === 'email')
  const hasPassword = hasEmailIdentity || authUser?.user_metadata?.has_password === true
  const settingFirstPassword = isGoogle && !hasPassword

  const clear = (k: string) => setErrors(p => (p[k] ? { ...p, [k]: '' } : p))

  const handleSubmit = async () => {
    const next: Record<string, string> = {}
    if (!settingFirstPassword && !currentPassword) next.current = 'Enter your current password'
    const passErr = validatePassword(newPassword)
    if (passErr) next.new = passErr
    else if (!settingFirstPassword && currentPassword === newPassword) next.new = 'New password must be different from the current password'
    if (newPassword !== confirmPassword) next.confirm = 'Passwords do not match'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setLoading(true)
    try {
      if (!settingFirstPassword) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user?.email || '', password: currentPassword })
        if (signInErr) { setErrors({ current: 'Current password is incorrect' }); return }
      }
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { has_password: true },
      })
      if (error) throw error
      await refreshUser()
      toast.success(settingFirstPassword ? 'Password set. You can now also log in with your email and password.' : 'Password updated successfully')
      nav(backTo)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="top-bar flex items-center gap-3">
        <button onClick={() => nav(backTo)}>
          <IoArrowBack size={22} className="text-white" />
        </button>
        <h1 className="text-lg font-semibold text-white">{settingFirstPassword ? 'Set Password' : 'Change Password'}</h1>
      </div>

      <div className="flex-1 px-5 py-6 space-y-5">
        {settingFirstPassword && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-medium text-blue-700 mb-1">You signed up with Google</p>
            <p className="text-xs text-blue-600 leading-relaxed">
              Your account has no password yet, so there is no current password to enter. Set one below to also log in with {user?.email} and your password.
            </p>
          </div>
        )}

        {!settingFirstPassword && (
          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">Current Password</label>
            <PasswordInput value={currentPassword} onChange={v => { setCurrentPassword(v); clear('current') }} placeholder="Enter current password" hasError={!!errors.current} />
            <FieldError message={errors.current} />
          </div>
        )}

        <div>
          <label className="text-sm text-text-secondary mb-1.5 block">New Password</label>
          <PasswordInput value={newPassword} onChange={v => { setNewPassword(v); clear('new') }} placeholder="Enter new password" hasError={!!errors.new} />
          {errors.new ? <FieldError message={errors.new} /> : <p className="text-[11px] text-text-muted mt-1 leading-snug">{PASSWORD_HINT}</p>}
        </div>

        <div>
          <label className="text-sm text-text-secondary mb-1.5 block">Confirm New Password</label>
          <PasswordInput value={confirmPassword} onChange={v => { setConfirmPassword(v); clear('confirm') }} placeholder="Confirm new password" hasError={!!errors.confirm} />
          <FieldError message={errors.confirm} />
        </div>

        <button onClick={handleSubmit} disabled={loading} className="btn-primary w-full mt-6">
          {loading ? 'Saving...' : settingFirstPassword ? 'Set Password' : 'Update Password'}
        </button>
      </div>
    </div>
  )
}
