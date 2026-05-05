import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoEye, IoEyeOff } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

export default function WorkerChangePassword() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return toast.error('Please fill in all fields')
    }
    if (newPassword.length < 8) {
      return toast.error('New password must be at least 8 characters')
    }
    if (!/[A-Z]/.test(newPassword)) {
      return toast.error('New password must contain at least one uppercase letter')
    }
    if (!/[0-9]/.test(newPassword)) {
      return toast.error('New password must contain at least one number')
    }
    if (newPassword !== confirmPassword) {
      return toast.error('New passwords do not match')
    }
    if (currentPassword === newPassword) {
      return toast.error('New password must be different from current password')
    }

    setLoading(true)
    try {
      // Re-authenticate with current password to verify it's correct
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      })
      if (signInErr) {
        return toast.error('Current password is incorrect')
      }
      // Now update to the new password
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Password updated successfully')
      nav('/worker/profile')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="top-bar flex items-center gap-3">
        <button onClick={() => nav('/worker/profile')}>
          <IoArrowBack size={22} className="text-white" />
        </button>
        <h1 className="text-lg font-semibold text-white">Change Password</h1>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 py-6 space-y-5">
        {/* Current Password */}
        <div>
          <label className="text-sm text-text-secondary mb-1.5 block">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              placeholder="Enter current password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
            >
              {showCurrent ? <IoEyeOff size={18} /> : <IoEye size={18} />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="text-sm text-text-secondary mb-1.5 block">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              placeholder="Enter your password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
            >
              {showNew ? <IoEyeOff size={18} /> : <IoEye size={18} />}
            </button>
          </div>
        </div>

        {/* Confirm New Password */}
        <div>
          <label className="text-sm text-text-secondary mb-1.5 block">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
            >
              {showConfirm ? <IoEyeOff size={18} /> : <IoEye size={18} />}
            </button>
          </div>
        </div>

        {/* Password Requirements */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-700 mb-2">Password requirements:</p>
          <ul className="text-xs text-blue-600 space-y-1">
            <li className="flex items-center gap-2">
              <span className={newPassword.length >= 6 ? 'text-green-500' : ''}>•</span>
              At least 6 characters
            </li>
            <li className="flex items-center gap-2">
              <span className={/[a-zA-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? 'text-green-500' : ''}>•</span>
              Mix of letters and numbers recommended
            </li>
          </ul>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary w-full mt-6"
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </div>
    </div>
  )
}
