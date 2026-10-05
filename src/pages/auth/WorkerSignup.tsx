import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { IoArrowBack, IoCamera, IoCheckmarkCircle, IoCloudUpload, IoClose } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { emailRedirect } from '../../lib/authRedirect'
import { WORKER_SKILL_CATEGORIES, PAKISTAN_CITIES } from '../../types'
import {
  PASSWORD_HINT,
  formatCNICDisplay,
  normalizePhone,
  phoneVariants,
  validateCNIC,
  validateEmail,
  validateImageFile,
  validatePakistanPhone,
  validatePassword,
  validatePersonName,
} from '../../lib/validation'
import { MAX_WORKER_SKILLS, SKILL_URDU } from '../../lib/skills'
import { uploadPublic, withTimeout } from '../../lib/image'
import { useAuth } from '../../hooks/useAuth'
import FieldError from '../../components/FieldError'
import toast from 'react-hot-toast'

const STEPS: { en: string; ur: string }[] = [
  { en: 'Personal Info', ur: 'ذاتی معلومات' },
  { en: 'Skills & City', ur: 'ہنر اور شہر' },
  { en: 'Documents', ur: 'دستاویزات' },
  { en: 'Summary', ur: 'خلاصہ' },
]

function Bi({ en, ur, required }: { en: string; ur: string; required?: boolean }) {
  return (
    <span className="flex items-center justify-between w-full gap-2">
      <span>{en}{required && ' *'}</span>
      <span dir="rtl" className="text-text-muted">{ur}{required && ' *'}</span>
    </span>
  )
}

export default function WorkerSignup() {
  const nav = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const submitLockRef = useRef(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [city, setCity] = useState('')
  const [cnic, setCnic] = useState('')
  const [cnicFront, setCnicFront] = useState<File | null>(null)
  const [cnicBack, setCnicBack] = useState<File | null>(null)

  const clearError = (key: string) => setErrors(p => (p[key] ? { ...p, [key]: '' } : p))

  const toggleSkill = (s: string) => {
    setSkills(prev => {
      if (prev.includes(s)) return prev.filter(x => x !== s)
      if (prev.length >= MAX_WORKER_SKILLS) {
        setErrors(p => ({ ...p, skills: `You can select a maximum of ${MAX_WORKER_SKILLS} skills / زیادہ سے زیادہ ${MAX_WORKER_SKILLS} ہنر منتخب کریں` }))
        return prev
      }
      clearError('skills')
      return [...prev, s]
    })
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); clearError('photo') }
  }

  const handleCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      setShowCamera(true)
    } catch {
      toast.error('Camera access denied. Please use the upload option.')
      document.getElementById('worker-photo-input')?.click()
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !streamRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 800
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
        setPhoto(file)
        setPhotoPreview(URL.createObjectURL(file))
        clearError('photo')
      }
      streamRef.current?.getTracks().forEach(t => t.stop())
      setShowCamera(false)
    }, 'image/jpeg', 0.8)
  }

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    setShowCamera(false)
  }

  useEffect(() => {
    if (showCamera && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current
  }, [showCamera])

  const validateStep = (s: number): Record<string, string> => {
    const next: Record<string, string> = {}
    if (s === 0) {
      if (!photo) next.photo = 'Please add a profile photo / پروفائل تصویر لگائیں'
      else { const pe = validateImageFile(photo, { required: true }); if (pe) next.photo = pe }
      const n = validatePersonName(name); if (n) next.name = n
      const e = validateEmail(email); if (e) next.email = e
      const p = validatePassword(password); if (p) next.password = p
      const ph = validatePakistanPhone(phone, { optional: false }); if (ph) next.phone = ph
    }
    if (s === 1) {
      if (skills.length === 0) next.skills = 'Select at least one skill / کم از کم ایک ہنر منتخب کریں'
      if (!city) next.city = 'Please select your city / شہر منتخب کریں'
    }
    if (s === 2) {
      const c = validateCNIC(cnic); if (c) next.cnic = c
      const f = validateImageFile(cnicFront, { required: true }); if (f) next.cnicFront = f
      const b = validateImageFile(cnicBack, { required: true }); if (b) next.cnicBack = b
    }
    return next
  }

  const nextStep = () => {
    const next = validateStep(step)
    setErrors(next)
    if (Object.keys(next).length === 0) setStep(s => Math.min(s + 1, 3))
  }

  const handleSubmit = async () => {
    for (let s = 0; s <= 2; s++) {
      const e = validateStep(s)
      if (Object.keys(e).length > 0) { setErrors(e); setStep(s); return }
    }
    if (submitLockRef.current) return
    submitLockRef.current = true
    setLoading(true)

    try {
      const phoneForDb = normalizePhone(phone)
      const { data: phoneTaken, error: phoneErr } = await withTimeout(
        supabase.rpc('fn_phone_exists', { p_phones: phoneVariants(phone) }),
      )
      if (phoneErr) throw new Error('Could not verify phone number. Please try again.')
      if (phoneTaken === true) {
        setErrors({ phone: 'This phone number is already registered. Use a different number or log in.' })
        setStep(0)
        return
      }

      const { data: authData, error } = await withTimeout(
        supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: emailRedirect('/email-confirmed') } }),
      )
      if (error) {
        const msg = error.message?.toLowerCase() || ''
        if (msg.includes('rate') || msg.includes('too many') || msg.includes('limit')) {
          toast.error('Too many signup attempts. Please wait a few minutes and try again.')
        } else if (msg.includes('password')) {
          setErrors({ password: error.message }); setStep(0)
        } else {
          setErrors({ email: error.message }); setStep(0)
        }
        return
      }
      const userId = authData.user?.id
      if (!userId) throw new Error('Signup failed. Please try again.')
      if ((authData.user?.identities?.length ?? 0) === 0) {
        setErrors({ email: 'An account with this email already exists. Please log in instead.' })
        setStep(0)
        return
      }

      const ts = Date.now()
      const [photoUrl, cnicFrontUrl, cnicBackUrl] = await Promise.all([
        uploadPublic('avatars', `${userId}_${ts}.jpg`, photo!),
        uploadPublic('signup-docs', `cnic/${userId}_${ts}_front.jpg`, cnicFront!),
        uploadPublic('signup-docs', `cnic/${userId}_${ts}_back.jpg`, cnicBack!),
      ])

      const { error: usersErr } = await withTimeout(supabase.rpc('handle_signup_user', {
        p_id: userId, p_name: name.trim(), p_email: email.trim(), p_phone: phoneForDb,
        p_role: 'worker', p_city: city, p_profile_photo_url: photoUrl, p_verified: false,
      }))
      if (usersErr) throw usersErr

      const { error: profileErr } = await withTimeout(supabase.rpc('handle_signup_worker_profile', {
        p_user_id: userId, p_skills: skills, p_bio: null,
        p_cnic: formatCNICDisplay(cnic), p_cnic_front_url: cnicFrontUrl, p_cnic_back_url: cnicBackUrl,
        p_certificate_urls: null,
      }))
      if (profileErr) throw profileErr

      const { error: completeErr } = await withTimeout(supabase.rpc('handle_complete_signup_profile', {
        p_id: userId, p_profile_complete: true,
      }))
      if (completeErr) throw completeErr

      setIsSubmitted(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message
      if (message?.includes('users_phone_unique') || message?.includes('phone_unique')) {
        setErrors({ phone: 'This phone number is already registered. Use a different number or log in.' })
        setStep(0)
      } else {
        toast.error(message || 'Signup failed. Please try again.')
      }
    } finally {
      setLoading(false)
      submitLockRef.current = false
    }
  }

  if (!authLoading && user && !user.profile_complete) return <Navigate to="/complete-profile/worker" replace />

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center animate-fade-in">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">Check your email</h2>
        <p className="text-text-secondary text-sm mb-8">
          We've sent a verification link to<br /> <span className="font-semibold text-text-primary">{email}</span>.
          <br /><br />
          Click the link in the email to activate your account.
        </p>
        <button onClick={() => nav('/login/worker')} className="text-sm font-medium text-primary">Back to Login</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="top-bar">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => (step > 0 ? setStep(s => s - 1) : nav(-1))}>
            <IoArrowBack size={22} className="text-white" />
          </button>
          <h1 className="text-lg font-semibold text-white flex-1 flex items-center justify-between">
            <span>Worker Registration</span>
            <span dir="rtl" className="text-white/80 text-base">ورکر رجسٹریشن</span>
          </h1>
        </div>
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div key={s.en} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-white' : 'bg-white/20'}`} />
              <p className={`text-[10px] mt-1 ${i <= step ? 'text-white' : 'text-white/40'}`}>{s.en}</p>
              <p dir="rtl" className={`text-[10px] ${i <= step ? 'text-white/80' : 'text-white/30'}`}>{s.ur}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 py-6 overflow-y-auto">
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-center mb-2">
              <div className="flex flex-col items-center gap-3">
                <div className={`w-24 h-24 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden ${errors.photo ? 'border-danger bg-red-50' : photoPreview ? 'border-primary bg-primary/5' : 'bg-surface border-border'}`}>
                  {photoPreview ? <img src={photoPreview} className="w-full h-full object-cover" /> : <IoCamera size={28} className="text-text-muted" />}
                </div>
                <p className="text-xs text-text-muted">Profile photo * / پروفائل تصویر *</p>
                <div className="flex gap-2">
                  <button type="button" onClick={handleCamera} className="px-4 py-2 bg-primary text-white text-xs rounded-lg flex items-center gap-1">
                    <IoCamera size={14} /> Take Selfie
                  </button>
                  <label className="px-4 py-2 bg-gray-100 text-gray-700 text-xs rounded-lg flex items-center gap-1 cursor-pointer">
                    <IoCloudUpload size={14} /> Upload
                    <input id="worker-photo-input" type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                  </label>
                </div>
                <FieldError message={errors.photo} />
              </div>
            </div>
            <div>
              <label className="text-sm text-text-secondary mb-1.5 block"><Bi en="Full Name" ur="پورا نام" required /></label>
              <input
                placeholder="Enter your name"
                value={name}
                onChange={e => { setName(e.target.value.replace(/[^a-zA-Z\s]/g, '')); clearError('name') }}
                className={errors.name ? 'field-error' : ''}
                maxLength={80}
                autoComplete="name"
              />
              <FieldError message={errors.name} />
            </div>
            <div>
              <label className="text-sm text-text-secondary mb-1.5 block"><Bi en="Email" ur="ای میل" required /></label>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={e => { setEmail(e.target.value); clearError('email') }}
                className={errors.email ? 'field-error' : ''} />
              <FieldError message={errors.email} />
            </div>
            <div>
              <label className="text-sm text-text-secondary mb-1.5 block"><Bi en="Password" ur="پاس ورڈ" required /></label>
              <input type="password" placeholder="Create a password" value={password}
                onChange={e => { setPassword(e.target.value); clearError('password') }}
                className={errors.password ? 'field-error' : ''} autoComplete="new-password" />
              {errors.password ? <FieldError message={errors.password} /> : <p className="text-[11px] text-text-muted mt-1 leading-snug">{PASSWORD_HINT}</p>}
            </div>
            <div>
              <label className="text-sm text-text-secondary mb-1.5 block"><Bi en="Phone Number" ur="فون نمبر" required /></label>
              <input type="tel" placeholder="03XX-XXXXXXX" value={phone}
                onChange={e => { setPhone(e.target.value.replace(/[^0-9]/g, '')); clearError('phone') }}
                className={errors.phone ? 'field-error' : ''} maxLength={11} />
              <FieldError message={errors.phone} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <label className="section-title flex items-center justify-between">
                <span>Select Your Skills (Max {MAX_WORKER_SKILLS}) *</span>
                <span dir="rtl">اپنے ہنر منتخب کریں *</span>
              </label>
              <p className="text-xs text-text-muted mb-2">{skills.length}/{MAX_WORKER_SKILLS}</p>
              <div className={`grid grid-cols-2 gap-2 mt-2 ${errors.skills ? 'p-1 rounded-xl border border-danger' : ''}`}>
                {WORKER_SKILL_CATEGORIES.map(cat => (
                  <button key={cat.name} type="button" onClick={() => toggleSkill(cat.name)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm transition text-left ${skills.includes(cat.name) ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-text-secondary'}`}>
                    <span>{cat.icon}</span>
                    <span className="flex flex-col leading-tight">
                      <span>{cat.name}</span>
                      <span dir="rtl" className="text-[11px] text-text-muted">{SKILL_URDU[cat.name]}</span>
                    </span>
                    {skills.includes(cat.name) && <IoCheckmarkCircle className="ml-auto text-primary shrink-0" />}
                  </button>
                ))}
              </div>
              <FieldError message={errors.skills} />
            </div>
            <div>
              <label className="text-sm text-text-secondary mb-1.5 block"><Bi en="City" ur="شہر" required /></label>
              <select value={city} onChange={e => { setCity(e.target.value); clearError('city') }}
                className={`${!city ? 'text-text-muted' : ''} ${errors.city ? 'field-error' : ''}`}>
                <option value="">Select city</option>
                {PAKISTAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <FieldError message={errors.city} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <label className="text-sm text-text-secondary mb-1.5 block"><Bi en="CNIC Number" ur="شناختی کارڈ نمبر" required /></label>
              <input placeholder="12345-1234567-1" value={cnic}
                onChange={e => { setCnic(e.target.value.replace(/[^0-9-]/g, '')); clearError('cnic') }}
                className={errors.cnic ? 'field-error' : ''} maxLength={15} />
              <FieldError message={errors.cnic} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'cnicFront', file: cnicFront, set: setCnicFront, en: 'CNIC Front', ur: 'کارڈ سامنے' },
                { key: 'cnicBack', file: cnicBack, set: setCnicBack, en: 'CNIC Back', ur: 'کارڈ پیچھے' },
              ] as const).map(f => (
                <div key={f.key}>
                  <label className="cursor-pointer block">
                    <div className={`h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition ${errors[f.key] ? 'border-danger bg-red-50' : f.file ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      {f.file ? <IoCheckmarkCircle size={28} className="text-primary" /> : <IoCloudUpload size={28} className="text-text-muted" />}
                      <span className="text-xs text-text-secondary">{f.file ? '✓' : `${f.en} *`}</span>
                      <span dir="rtl" className="text-[11px] text-text-muted">{f.ur}</span>
                    </div>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { f.set(e.target.files?.[0] || null); clearError(f.key) }} />
                  </label>
                  <FieldError message={errors[f.key]} />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 animate-fade-in">
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-text-primary">Registration Summary</p>
                <p dir="rtl" className="text-base font-semibold text-text-primary">رجسٹریشن کا خلاصہ</p>
              </div>
              {photoPreview && <img src={photoPreview} className="w-20 h-20 rounded-full object-cover mx-auto" />}
              {[
                { en: 'Name', ur: 'نام', v: name },
                { en: 'Email', ur: 'ای میل', v: email },
                { en: 'Phone', ur: 'فون', v: phone },
                { en: 'City', ur: 'شہر', v: city },
                { en: 'Skills', ur: 'ہنر', v: skills.map(s => `${s} (${SKILL_URDU[s]})`).join(', ') },
                { en: 'CNIC', ur: 'شناختی کارڈ', v: formatCNICDisplay(cnic) },
              ].map(r => (
                <div key={r.en} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0">
                  <div className="text-sm text-text-muted shrink-0">{r.en} <span dir="rtl">/ {r.ur}</span></div>
                  <div className="text-sm font-medium text-text-primary text-right break-words">{r.v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 space-y-3">
          {step < 3 ? (
            <button type="button" onClick={nextStep} className="btn-primary">Next / آگے</button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary">
              {loading ? 'Creating Account...' : 'Submit Registration / جمع کروائیں'}
            </button>
          )}
          {step > 0 && <button type="button" onClick={() => setStep(s => s - 1)} className="btn-ghost">Back / پیچھے</button>}
        </div>
      </div>

      {showCamera && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 bg-black">
            <p className="text-white font-medium">Take Selfie</p>
            <button onClick={closeCamera} className="text-white p-2"><IoClose size={24} /></button>
          </div>
          <div className="flex-1 flex items-center justify-center bg-black relative">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <button onClick={capturePhoto} className="w-16 h-16 rounded-full border-4 border-white bg-primary flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
