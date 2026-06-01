import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoLogoGoogle, IoMail, IoLockClosed, IoLanguage, IoEyeOutline, IoEyeOffOutline } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { emailRedirect, isNativeApp } from '../../lib/authRedirect'
import { signInWithGoogleNative } from '../../lib/nativeAuth'
import { assertEmailConfirmed } from '../../lib/authRole'
import { validateEmail } from '../../lib/validation'
import { useI18n } from '../../lib/i18n'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

type AuthTab = 'login' | 'signup'

export default function Login() {
  const nav = useNavigate()
  const { t, language, setLanguage } = useI18n()
  const { setUserDirectly } = useAuth()
  const [activeTab, setActiveTab] = useState<AuthTab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  const handleResend = async () => {
    const emailErr = validateEmail(email)
    if (emailErr) return toast.error(emailErr)
    setResendLoading(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: emailRedirect('/customer/home') },
    })
    setResendLoading(false)
    if (error) toast.error(error.message)
    else toast.success('Confirmation email sent. Check your inbox.')
  }

  const handleEmailLogin = async () => {
    if (!password) return toast.error('Please enter your password')
    const emailErr = validateEmail(email)
    if (emailErr) return toast.error(emailErr)
    setLoading(true)
    setShowResend(false)

    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      const msg = error.message?.toLowerCase() || ''
      if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
        setShowResend(true)
        toast.error('Email not verified. Check your inbox for the confirmation link.')
      } else if (msg.includes('invalid') || msg.includes('credentials') || msg.includes('not found') || msg.includes('no user')) {
        toast.error('Invalid credentials. Please check your email and password.')
      } else {
        toast.error(error.message)
      }
      return
    }

    const emailCheck = await assertEmailConfirmed()
    if (!emailCheck.ok) {
      setLoading(false)
      setShowResend(true)
      return toast.error(emailCheck.message)
    }

    if (!signInData.user || !signInData.session) {
      setLoading(false)
      toast.error('Login failed. Please try again.')
      return
    }

    // Directly fetch user profile — do NOT wait for onAuthStateChange
    const { data: userData, error: userErr } = await supabase
      .from('users').select('*').eq('id', signInData.user.id).maybeSingle()

    if (userErr || !userData) {
      setLoading(false)
      toast.error('Could not load your account. Please try again.')
      return
    }

    if (userData.role !== 'customer' && userData.role !== 'admin') {
      await supabase.auth.signOut({ scope: 'local' })
      setLoading(false)
      toast.error('This account is registered as a worker. Please use the worker login.')
      return
    }

    // Inject user into auth context immediately — AuthRoute will redirect
    setUserDirectly(userData, signInData.session)

    if (!userData.profile_complete) {
      nav('/complete-profile/customer', { replace: true })
    } else {
      nav(userData.role === 'admin' ? '/admin' : '/customer/home', { replace: true })
    }
  }

  useEffect(() => {
    const err = sessionStorage.getItem('auth-portal-error')
    if (err) { sessionStorage.removeItem('auth-portal-error'); toast.error(err) }
  }, [])

  const handleGoogle = async () => {
    setGoogleLoading(true)
    sessionStorage.setItem('auth-intended-portal', 'customer')
    localStorage.setItem('oauth-intended-role', 'customer')
    try {
      if (isNativeApp()) {
        await signInWithGoogleNative('customer')
        setGoogleLoading(false)
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: emailRedirect('/customer/home') },
        })
        if (error) throw error
      }
    } catch (err: any) {
      sessionStorage.removeItem('auth-intended-portal')
      localStorage.removeItem('oauth-intended-role')
      toast.error(err.message || 'Google sign-in failed')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-primary px-6 pt-12 pb-8 rounded-b-3xl text-center relative">
        <button
          onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
          className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1.5 bg-white/20 rounded-lg text-xs text-white"
        >
          <IoLanguage size={14} />
          <span>{language === 'ur' ? 'اردو' : 'EN'}</span>
        </button>
        <img src="/logo.png" alt="KarigarGo" className="w-16 h-16 mx-auto mb-2 rounded-2xl" />
        <p className="text-white/80 text-sm mt-1">Har Kaam Ka Karigar, Bas Ek Tap Dur</p>
        <div className="flex gap-3 mt-6">
          <div className="flex-1 bg-white/15 border border-white/30 rounded-2xl py-3.5 px-3">
            <p className="text-white font-semibold text-sm">{t('customer')}</p>
            <p className="text-white/60 text-xs mt-0.5">{t('hireWorkers')}</p>
          </div>
          <button
            onClick={() => nav('/login/worker')}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl py-3.5 px-3 hover:bg-white/10 transition"
          >
            <p className="text-white/60 font-medium text-sm">{t('worker')}</p>
            <p className="text-white/40 text-xs mt-0.5">{t('findJobs')}</p>
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 pt-6 pb-8 overflow-y-auto">
        <div className="flex bg-surface rounded-xl p-1 mb-4">
          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'login' ? 'bg-white shadow-sm text-primary' : 'text-text-muted'}`}
          >
            {t('login')}
          </button>
          <button
            onClick={() => setActiveTab('signup')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === 'signup' ? 'bg-white shadow-sm text-primary' : 'text-text-muted'}`}
          >
            {t('signup')}
          </button>
        </div>

        {activeTab === 'login' ? (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">{t('email')}</label>
              <div className="relative">
                <IoMail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="email"
                  placeholder={t('email')}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="!pl-10"
                  onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">{t('password')}</label>
              <div className="relative">
                <IoLockClosed size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('password')}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="!pl-10 !pr-10"
                  onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted"
                >
                  {showPassword ? <IoEyeOffOutline size={18} /> : <IoEyeOutline size={18} />}
                </button>
              </div>
            </div>
            <p className="text-sm text-primary font-medium text-right cursor-pointer" onClick={() => nav('/forgot-password')}>{t('forgotPassword')}</p>
            <button onClick={handleEmailLogin} disabled={loading} className="btn-primary">
              {loading ? t('loading') : t('login')}
            </button>

            {showResend && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 animate-fade-in">
                <p className="text-sm text-amber-800 font-medium mb-1">Email not verified?</p>
                <p className="text-xs text-amber-700 mb-3">
                  Open the link we sent you, or request a new confirmation email.
                </p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="text-sm font-semibold text-amber-800 underline disabled:opacity-50"
                >
                  {resendLoading ? 'Sending...' : 'Resend confirmation email'}
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-text-muted">{t('or')}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button onClick={handleGoogle} disabled={googleLoading} className="btn-ghost flex items-center justify-center gap-3">
              {googleLoading ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <IoLogoGoogle size={18} className="text-[#4285F4]" />}
              {googleLoading ? 'Redirecting...' : t('signInWithGoogle')}
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in text-center py-6">
            <button onClick={() => nav('/signup/customer')} className="btn-primary">
              {t('customerRegistration')}
            </button>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-text-muted">{t('or')}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <button onClick={handleGoogle} disabled={googleLoading} className="btn-ghost flex items-center justify-center gap-3">
              {googleLoading ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <IoLogoGoogle size={18} className="text-[#4285F4]" />}
              {googleLoading ? 'Redirecting...' : t('signUpWithGoogle')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
