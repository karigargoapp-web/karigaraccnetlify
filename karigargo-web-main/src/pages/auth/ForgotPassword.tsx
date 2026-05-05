import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoMail } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { emailRedirect } from '../../lib/authRedirect'
import { validateEmail } from '../../lib/validation'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    const emailErr = validateEmail(email)
    if (emailErr) return toast.error(emailErr)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: emailRedirect('/reset-password'),
    })
    setLoading(false)
    if (error) return toast.error(error.message)
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-primary px-6 pt-12 pb-8 rounded-b-3xl text-center">
        <img src="/logo.png" alt="KarigarGo" className="w-16 h-16 mx-auto mb-2 rounded-2xl" />
        <p className="text-white font-semibold text-lg mt-1">Forgot Password</p>
        <p className="text-white/70 text-sm mt-1">We'll send a reset link to your email</p>
      </div>

      <div className="flex-1 px-6 pt-8 pb-8">
        {sent ? (
          <div className="text-center space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <IoMail size={32} className="text-primary" />
            </div>
            <p className="text-base font-semibold text-text-primary">Check your inbox</p>
            <p className="text-sm text-text-secondary">
              We sent a password reset link to <span className="font-medium text-text-primary">{email}</span>.
              Click the link in the email to set a new password.
            </p>
            <button onClick={() => nav(-1)} className="btn-primary mt-4">
              Back to Login
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Email Address</label>
              <div className="relative">
                <IoMail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="!pl-10"
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  autoFocus
                />
              </div>
            </div>
            <button onClick={handleSend} disabled={loading} className="btn-primary">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button
              onClick={() => nav(-1)}
              className="w-full flex items-center justify-center gap-2 text-sm text-text-muted py-2"
            >
              <IoArrowBack size={14} /> Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
