import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoLockClosed, IoEyeOutline, IoEyeOffOutline, IoCheckmarkCircle } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [checked, setChecked] = useState(false)

  // Poll for recovery session established by Supabase from URL hash
  // useAuth skips PASSWORD_RECOVERY events, so we check directly here
  useEffect(() => {
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      const { data } = await supabase.auth.getSession()
      if (data.session || attempts > 20) {
        setChecked(true)
        clearInterval(interval)
      }
    }, 250)
    return () => clearInterval(interval)
  }, [])

  // Also consider valid if useAuth already has a session
  const validSession = Boolean(session) || checked

  const handleReset = async () => {
    if (!password) return toast.error('Enter a new password')
    if (password.length < 8) return toast.error('Password must be at least 8 characters')
    if (password !== confirm) return toast.error('Passwords do not match')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return toast.error(error.message)
    setDone(true)
    await supabase.auth.signOut()
  }

  if (!validSession) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="bg-primary px-6 pt-12 pb-8 rounded-b-3xl text-center">
          <img src="/logo.png" alt="KarigarGo" className="w-16 h-16 mx-auto mb-2 rounded-2xl" />
          <p className="text-white font-semibold text-lg mt-1">Reset Password</p>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center space-y-3">
            <p className="text-sm text-text-secondary">Verifying your reset link…</p>
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-primary px-6 pt-12 pb-8 rounded-b-3xl text-center">
        <img src="/logo.png" alt="KarigarGo" className="w-16 h-16 mx-auto mb-2 rounded-2xl" />
        <p className="text-white font-semibold text-lg mt-1">Set New Password</p>
        <p className="text-white/70 text-sm mt-1">Choose a strong password</p>
      </div>

      <div className="flex-1 px-6 pt-8 pb-8">
        {done ? (
          <div className="text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <IoCheckmarkCircle size={36} className="text-primary" />
            </div>
            <p className="text-base font-semibold text-text-primary">Password Updated!</p>
            <p className="text-sm text-text-secondary">Your password has been changed successfully. Please log in with your new password.</p>
            <button onClick={() => nav('/login')} className="btn-primary mt-4">
              Go to Login
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">New Password</label>
              <div className="relative">
                <IoLockClosed size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="!pl-10 !pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted"
                >
                  {showPw ? <IoEyeOffOutline size={18} /> : <IoEyeOutline size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Confirm Password</label>
              <div className="relative">
                <IoLockClosed size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="!pl-10"
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                />
              </div>
            </div>
            <button onClick={handleReset} disabled={loading} className="btn-primary">
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
