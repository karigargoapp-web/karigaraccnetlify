import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoCamera, IoCloudUpload, IoClose, IoLanguage } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { emailRedirect } from '../../lib/authRedirect'
import { PAKISTAN_CITIES } from '../../types'
import FieldError from '../../components/FieldError'
import {
  PASSWORD_HINT,
  validateEmail,
  validateImageFile,
  validatePassword,
  validatePersonName,
  validatePakistanPhone,
  normalizePhone,
  phoneVariants,
} from '../../lib/validation'
import { useI18n } from '../../lib/i18n'
import toast from 'react-hot-toast'

export default function CustomerSignup() {
  const nav = useNavigate()
  const { language, setLanguage } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const submitLockRef = useRef(false)

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const handleCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }
      })
      streamRef.current = stream
      setShowCamera(true)
    } catch (error) {
      toast.error('Camera access denied. Please use upload option.')
      document.getElementById('photo-input')?.click()
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !streamRef.current) return
    
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 800
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    
    canvas.toBlob((blob) => {
      if (blob) {
        // Convert Blob to File
        const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' })
        setPhoto(file)
        setPhotoPreview(URL.createObjectURL(file))
      }
      streamRef.current?.getTracks().forEach(track => track.stop())
      setShowCamera(false)
    }, 'image/jpeg', 0.8)
  }

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    setShowCamera(false)
  }

  useEffect(() => {
    if (showCamera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [showCamera])

  const handleSubmit = async () => {
    const next: Record<string, string> = {}
    if (!photo) next.photo = 'Please upload a profile photo'
    else { const pe = validateImageFile(photo, { required: false }); if (pe) next.photo = pe }
    const nameErr = validatePersonName(name); if (nameErr) next.name = nameErr
    const emailErr = validateEmail(email); if (emailErr) next.email = emailErr
    const phoneErr = phone ? validatePakistanPhone(phone, { optional: false }) : 'Please enter your phone number'
    if (phoneErr) next.phone = phoneErr
    const passErr = validatePassword(password); if (passErr) next.password = passErr
    if (!city) next.city = 'Please select your city'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    if (submitLockRef.current) return
    submitLockRef.current = true
    setLoading(true)

    const phoneForDb = normalizePhone(phone)
    const { data: existingPhone, error: phoneCheckError } = await supabase
      .from('users').select('id').in('phone', phoneVariants(phone)).limit(1)
    if (phoneCheckError) {
      toast.error('Could not verify phone number. Please try again.')
      setLoading(false)
      submitLockRef.current = false
      return
    }
    if (existingPhone && existingPhone.length > 0) {
      setErrors({ phone: 'This phone number is already registered. Use a different number or log in.' })
      setLoading(false)
      submitLockRef.current = false
      return
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: emailRedirect('/email-confirmed') },
      })
      if (authError) {
        const msg = authError.message?.toLowerCase() || ''
        if (msg.includes('rate') || msg.includes('too many')) {
          toast.error('Too many signup attempts. Please wait a few minutes and try again.')
        } else if (msg.includes('password')) {
          setErrors({ password: authError.message })
        } else if (msg.includes('email')) {
          setErrors({ email: authError.message })
        } else {
          toast.error(authError.message)
        }
        return
      }
      const userId = authData.user?.id ?? null
      if (!userId) {
        toast.error('Signup failed — could not get user ID')
        return
      }
      // Supabase silently returns a fake user when the email already exists
      // (identities array is empty). The fake UUID is not in auth.users → FK violation.
      if ((authData.user?.identities?.length ?? 0) === 0) {
        setErrors({ email: 'An account with this email already exists. Please log in instead.' })
        return
      }

      let photoUrl = ''
      if (photo) {
        const path = `avatars/${userId}_${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, photo)
        if (upErr) throw upErr
        photoUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      }

      const { error: insertErr } = await supabase.rpc('handle_signup_user', {
        p_id: userId,
        p_name: name,
        p_email: email,
        p_phone: phoneForDb,
        p_role: 'customer',
        p_city: city || null,
        p_profile_photo_url: photoUrl || null,
        p_verified: false,
      })
      if (insertErr) throw insertErr

      const { error: completeErr } = await supabase.rpc('handle_complete_signup_profile', {
        p_id: userId,
        p_profile_complete: true,
      })
      if (completeErr) throw completeErr

      setIsSubmitted(true)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Could not finish signup. Try again.'
      toast.error(message)
    } finally {
      setLoading(false)
      submitLockRef.current = false
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center animate-fade-in">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">Check your email</h2>
        <p className="text-text-secondary text-sm mb-8">
          We've sent a verification link to
          <br /> <span className="font-semibold text-text-primary">{email}</span>.
          <br />
          <br />
          Click the link in the email to activate your account.
        </p>
        <button onClick={() => nav('/login')} className="text-sm font-medium text-primary">
          Back to Login
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="top-bar flex items-center gap-3">
        <button onClick={() => nav(-1)}>
          <IoArrowBack size={22} className="text-white" />
        </button>
        <h1 className="text-lg font-semibold text-white">Create Customer Account</h1>
      </div>

      <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto pb-10">
        {/* Profile Photo */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full bg-surface border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
              {photoPreview ? (
                <img src={photoPreview} className="w-full h-full object-cover" />
              ) : (
                <IoCamera size={28} className="text-text-muted" />
              )}
            </div>
            <p className="text-xs text-text-muted">Profile photo *</p>
            <FieldError message={errors.photo} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCamera}
                className="px-4 py-2 bg-primary text-white text-xs rounded-lg flex items-center gap-1.5 font-medium"
              >
                <IoCamera size={14} />
                Take Selfie
              </button>
              <label className="px-4 py-2 bg-surface border border-border text-text-secondary text-xs rounded-lg flex items-center gap-1.5 cursor-pointer font-medium">
                <IoCloudUpload size={14} />
                Upload
                <input
                  id="photo-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhoto}
                />
              </label>
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm text-text-secondary mb-1.5 block">Full Name *</label>
          <input
            placeholder="Enter your name"
            value={name}
            onChange={e => {
              const cleaned = e.target.value.replace(/[^a-zA-Z\s]/g, '')
              setName(cleaned)
              if (errors.name) setErrors(p => ({ ...p, name: '' }))
            }}
            className={errors.name ? 'field-error' : ''}
            maxLength={80}
            autoComplete="name"
          />
          <FieldError message={errors.name} />
        </div>
        <div>
          <label className="text-sm text-text-secondary mb-1.5 block">Email *</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })) }}
            className={errors.email ? 'field-error' : ''}
          />
          <FieldError message={errors.email} />
        </div>
        <div>
          <label className="text-sm text-text-secondary mb-1.5 block">Phone Number *</label>
          <input
            type="tel"
            placeholder="03XX-XXXXXXX"
            value={phone}
            onChange={e => {
              const cleaned = e.target.value.replace(/[^0-9]/g, '')
              setPhone(cleaned)
              if (errors.phone) setErrors(p => ({ ...p, phone: '' }))
            }}
            className={errors.phone ? 'field-error' : ''}
            maxLength={11}
          />
          <FieldError message={errors.phone} />
        </div>
        <div>
          <label className="text-sm text-text-secondary mb-1.5 block">Password *</label>
          <input
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: '' })) }}
            className={errors.password ? 'field-error' : ''}
            autoComplete="new-password"
          />
          <FieldError message={errors.password} />
          <p className="text-[11px] text-text-muted mt-1 leading-snug">{PASSWORD_HINT}</p>
        </div>
        <div>
          <label className="text-sm text-text-secondary mb-1.5 block">City *</label>
          <select
            value={city}
            onChange={e => { setCity(e.target.value); if (errors.city) setErrors(p => ({ ...p, city: '' })) }}
            className={`${!city ? 'text-text-muted' : ''} ${errors.city ? 'field-error' : ''}`}
          >
            <option value="">Select city</option>
            {PAKISTAN_CITIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <FieldError message={errors.city} />
        </div>

        <button onClick={handleSubmit} disabled={loading} className="btn-primary !mt-8">
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>

        <p className="text-center text-sm text-text-secondary mt-4">
          Already have an account?{' '}
          <button onClick={() => nav('/login')} className="text-primary font-medium">
            Login
          </button>
        </p>
      </div>

      {/* Language Toggle - Bottom Right */}
      <button
        onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
        className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-white/90 rounded-lg shadow-sm text-sm text-text-primary z-10"
      >
        <IoLanguage size={16} className="text-primary" />
        <span>{language === 'ur' ? 'اردو' : 'EN'}</span>
      </button>

      {/* Camera Preview Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 bg-black">
            <p className="text-white font-medium">Take Selfie</p>
            <button onClick={closeCamera} className="text-white p-2">
              <IoClose size={24} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center bg-black relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-8 left-0 right-0 flex justify-center">
              <button
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full border-4 border-white bg-primary flex items-center justify-center"
              >
                <div className="w-12 h-12 rounded-full bg-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
