import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { IoArrowBack, IoCamera, IoCheckmarkCircle, IoCloudUpload, IoClose, IoLanguage } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { emailRedirect } from '../../lib/authRedirect'
import { SERVICE_CATEGORIES, PAKISTAN_CITIES } from '../../types'
import {
  formatCNICDisplay,
  PASSWORD_HINT,
  validateCertificateFile,
  validateCNIC,
  validateEmail,
  validateImageFile,
  validatePakistanPhone,
  validatePassword,
  validatePersonName,
  validateWorkerBio,
} from '../../lib/validation'
import { useI18n } from '../../lib/i18n'
import toast from 'react-hot-toast'

const STEPS = ['Personal Info', 'Skills & City', 'Documents', 'Bio']

export default function WorkerSignup() {
  const nav = useNavigate()
  const { user, refreshUser } = useAuth()
  const { language, setLanguage } = useI18n()
  // Google OAuth completion flow: user already signed in but profile_complete = false
  const isOAuthCompletion = !!user && !user.profile_complete
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const submitLockRef = useRef(false)

  // Step 1 — personal info
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Pre-fill from Google session
  useEffect(() => {
    if (isOAuthCompletion && user) {
      setName(user.name || '')
      setEmail(user.email || '')
      if (user.profile_photo_url) setPhotoPreview(user.profile_photo_url)
    }
  }, [isOAuthCompletion, user])

  // Step 2 — skills & city
  const [skills, setSkills] = useState<string[]>([])
  const [city, setCity] = useState('')

  // Step 3 — documents
  const [cnic, setCnic] = useState('')
  const [cnicFront, setCnicFront] = useState<File | null>(null)
  const [cnicBack, setCnicBack] = useState<File | null>(null)
  const [certificates, setCertificates] = useState<File[]>([])
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')

  // Step 4 — bio
  const [bio, setBio] = useState('')

  const toggleSkill = (s: string) => {
    setSkills(prev => {
      if (prev.includes(s)) {
        return prev.filter(x => x !== s)
      }
      // Limit to maximum 3 skills
      if (prev.length >= 3) {
        toast.error('You can select maximum 3 skills')
        return prev
      }
      return [...prev, s]
    })
  }

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)) }
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
      document.getElementById('worker-photo-input')?.click()
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

  const nextStep = () => {
    if (step === 0) {
      if (isOAuthCompletion) {
        const err = validatePakistanPhone(phone, { optional: false })
        if (err) return toast.error(err)
      } else {
        const err =
          validatePersonName(name) ||
          validateEmail(email) ||
          validatePassword(password) ||
          validatePakistanPhone(phone, { optional: false })
        if (err) return toast.error(err)
        if (!photo) return toast.error('Please upload a profile photo')
        const pe = validateImageFile(photo, { required: true })
        if (pe) return toast.error(pe)
      }
    }
    if (step === 1 && (skills.length === 0 || !city)) return toast.error('Select at least one skill and a city')
    if (step === 2) {
      const err =
        validateCNIC(cnic) ||
        validateImageFile(cnicFront, { required: true }) ||
        validateImageFile(cnicBack, { required: true })
      if (err) return toast.error(err)
      for (const cert of certificates) {
        const ce = validateCertificateFile(cert)
        if (ce) return toast.error(ce)
      }
    }
    setStep(s => Math.min(s + 1, 3))
  }

  const uploadFile = async (file: File, folder: string) => {
    const path = `${folder}/${Date.now()}_${file.name}`
    await supabase.storage.from('signup-docs').upload(path, file)
    const { data } = supabase.storage.from('signup-docs').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSubmit = async () => {
    const phoneErr = validatePakistanPhone(phone, { optional: false })
    const cnicErr = validateCNIC(cnic)
    const bioErr = validateWorkerBio(bio)
    const cnicFrontErr = validateImageFile(cnicFront, { required: true })
    const cnicBackErr = validateImageFile(cnicBack, { required: true })
    const preErr = phoneErr || cnicErr || bioErr || cnicFrontErr || cnicBackErr
    if (preErr) return toast.error(preErr)
    if (!isOAuthCompletion) {
      const authErr = validatePersonName(name) || validateEmail(email) || validatePassword(password)
      if (authErr) return toast.error(authErr)
      if (!photo) return toast.error('Please upload a profile photo')
      const pe = validateImageFile(photo, { required: true })
      if (pe) return toast.error(pe)
    }
    for (const cert of certificates) {
      const ce = validateCertificateFile(cert)
      if (ce) return toast.error(ce)
    }

    if (submitLockRef.current) return
    submitLockRef.current = true
    setLoading(true)
    try {
      let userId: string

      if (isOAuthCompletion) {
        // Already authenticated via Google OAuth — skip signUp()
        userId = user!.id
      } else {
        const { data: authData, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: emailRedirect('/email-confirmed') },
        })
        if (error) {
          const msg = error.message?.toLowerCase() || ''
          if (msg.includes('rate') || msg.includes('too many')) {
            toast.error('Too many signup attempts. Please wait a few minutes and try again.')
          } else {
            toast.error(error.message)
          }
          if (msg.includes('email') || msg.includes('password') || msg.includes('limit') || msg.includes('already')) {
            setStep(0)
          }
          return
        }
        const uid = authData.user?.id
        if (!uid) throw new Error('Signup failed — could not get user ID')
        if ((authData.user?.identities?.length ?? 0) === 0) {
          setStep(0)
          throw new Error('An account with this email already exists. Please log in instead.')
        }
        userId = uid
      }

      let photoUrl = isOAuthCompletion ? (user?.profile_photo_url || '') : ''
      let cnicFrontUrl = ''
      let cnicBackUrl = ''
      const certUrls: string[] = new Array(certificates.length)

      const uploadTasks: Promise<any>[] = [
        uploadFile(cnicFront!, 'cnic').then(url => cnicFrontUrl = url),
        uploadFile(cnicBack!, 'cnic').then(url => cnicBackUrl = url)
      ]

      if (!isOAuthCompletion && photo) {
        const path = `${userId}_${Date.now()}.jpg`
        uploadTasks.push(
          supabase.storage.from('avatars').upload(path, photo).then(({ error }) => {
            if (error) throw error
            const { data } = supabase.storage.from('avatars').getPublicUrl(path)
            photoUrl = data.publicUrl
          })
        )
      }

      certificates.forEach((cert, index) => {
        uploadTasks.push(uploadFile(cert, 'certificates').then(url => certUrls[index] = url))
      })

      await Promise.all(uploadTasks)

      const rawPhone = phone.trim()
      const phoneForDb = rawPhone.startsWith('0') ? '+92' + rawPhone.slice(1) : rawPhone

      // Check if phone number is already registered
      if (rawPhone) {
        const { data: existingPhone, error: phoneCheckError } = await supabase.from('users').select('id').eq('phone', phoneForDb).maybeSingle()
        if (phoneCheckError) {
          console.error('Phone check error:', phoneCheckError)
          toast.error('Could not verify phone number. Please try again.')
          setLoading(false)
          return
        }
        if (existingPhone) {
          toast.error('This phone number is already registered. Please use a different number or login.')
          setLoading(false)
          return
        }
      }

      const cnicFormatted = formatCNICDisplay(cnic)

      if (isOAuthCompletion) {
        // Update existing user row (phone, city) and mark profile complete
        const { error: updateErr } = await supabase
          .from('users')
          .update({ phone: phoneForDb, city, profile_complete: true })
          .eq('id', userId)
        if (updateErr) throw updateErr
      } else {
        const { error: usersErr } = await supabase.rpc('handle_signup_user', {
          p_id: userId,
          p_name: name.trim(),
          p_email: email.trim(),
          p_phone: phoneForDb,
          p_role: 'worker',
          p_city: city,
          p_profile_photo_url: photoUrl || null,
          p_verified: false,
        })
        if (usersErr) throw usersErr
      }

      const { error: profileErr } = await supabase.rpc('handle_signup_worker_profile', {
        p_user_id: userId,
        p_skills: skills,
        p_bio: bio || null,
        p_cnic: cnicFormatted,
        p_cnic_front_url: cnicFrontUrl,
        p_cnic_back_url: cnicBackUrl,
        p_certificate_urls: certUrls.length > 0 ? certUrls : null,
      })
      if (profileErr) throw profileErr

      if (!isOAuthCompletion) {
        const { error: completeErr } = await supabase.rpc('handle_complete_signup_profile', {
          p_id: userId,
          p_profile_complete: true,
        })
        if (completeErr) throw completeErr
        setIsSubmitted(true)
      } else {
        await refreshUser()
        toast.success('Profile completed!')
        nav('/worker/dashboard', { replace: true })
      }
    } catch (err: any) {
      toast.error(err.message || 'Signup failed')
      const msg = err.message?.toLowerCase() || ''
      if (!isOAuthCompletion && (msg.includes('email') || msg.includes('password') || msg.includes('limit') || msg.includes('already'))) {
        setStep(0)
      }
    } finally {
      setLoading(false)
      submitLockRef.current = false
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center animate-fade-in">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
          <IoArrowBack className="hidden" />
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-2">Check your email</h2>
        <p className="text-text-secondary text-sm mb-8">
          We've sent a verification link to<br /> <span className="font-semibold text-text-primary">{email}</span>.
          <br /><br />
          Click the link in the email to activate your account. You will be logged in automatically!
        </p>
        <button onClick={() => nav('/login')} className="text-sm font-medium text-primary">
          Back to Login
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="top-bar">
        <div className="flex items-center gap-3 mb-4">
          <button
          onClick={() => step > 0 ? setStep(s => s - 1) : nav(-1)}
          disabled={isOAuthCompletion && step === 0}
          className={`${isOAuthCompletion && step === 0 ? 'invisible' : ''}`}
        >
          <IoArrowBack size={22} className="text-white" />
        </button>
          <h1 className="text-lg font-semibold text-white">Worker Registration</h1>
        </div>
        {/* Progress */}
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-white' : 'bg-white/20'}`} />
              <p className={`text-[10px] mt-1 ${i <= step ? 'text-white' : 'text-white/40'}`}>{s}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 py-6 overflow-y-auto">
        {/* Step 0 — Personal */}
        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            {isOAuthCompletion ? (
              /* Google OAuth completion — show read-only profile card */
              <div className="flex items-center gap-3 bg-surface rounded-2xl px-4 py-3">
                {photoPreview ? (
                  <img src={photoPreview} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">{name?.[0]}</span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-text-primary">{name}</p>
                  <p className="text-xs text-text-muted">{email}</p>
                </div>
              </div>
            ) : (
              /* Normal signup — photo upload + name/email/password */
              <>
                <div className="flex justify-center mb-2">
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-24 h-24 rounded-full border-2 border-dashed flex items-center justify-center overflow-hidden ${photoPreview ? 'border-primary bg-primary/5' : 'bg-surface border-red-400'}`}>
                      {photoPreview ? <img src={photoPreview} className="w-full h-full object-cover" /> : <IoCamera size={28} className="text-red-400" />}
                    </div>
                    <p className="text-xs text-red-500 font-medium">Profile photo required *</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCamera}
                        className="px-4 py-2 bg-primary text-white text-xs rounded-lg flex items-center gap-1"
                      >
                        <IoCamera size={14} />
                        Take Selfie
                      </button>
                      <label className="px-4 py-2 bg-gray-100 text-gray-700 text-xs rounded-lg flex items-center gap-1 cursor-pointer">
                        <IoCloudUpload size={14} />
                        Upload
                        <input
                          id="worker-photo-input"
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
                    }}
                    maxLength={80}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="text-sm text-text-secondary mb-1.5 block">Email *</label>
                  <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-text-secondary mb-1.5 block">Password *</label>
                  <input
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <p className="text-[11px] text-text-muted mt-1 leading-snug">{PASSWORD_HINT}</p>
                </div>
              </>
            )}
            <div>
              <label className="text-sm text-text-secondary mb-1.5 block">Phone Number *</label>
              <input
                type="tel"
                placeholder="03XX-XXXXXXX"
                value={phone}
                onChange={e => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, '')
                  setPhone(cleaned)
                }}
                maxLength={11}
              />
            </div>
          </div>
        )}

        {/* Step 1 — Skills & City */}
        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <label className="section-title">Select Your Skills (Max 3) *</label>
              <p className="text-xs text-text-muted mb-2">{skills.length}/3 skills selected</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {SERVICE_CATEGORIES.map(cat => (
                  <button key={cat.name} onClick={() => toggleSkill(cat.name)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm transition ${skills.includes(cat.name) ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-text-secondary'}`}>
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                    {skills.includes(cat.name) && <IoCheckmarkCircle className="ml-auto text-primary" />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm text-text-secondary mb-1.5 block">City *</label>
              <select value={city} onChange={e => setCity(e.target.value)} className={!city ? 'text-text-muted' : ''}>
                <option value="">Select city</option>
                {PAKISTAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Step 2 — Documents */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <label className="text-sm text-text-secondary mb-1.5 block">CNIC Number *</label>
              <input 
                placeholder="12345-1234567-1" 
                value={cnic} 
                onChange={e => {
                  // Only allow numbers and hyphens
                  const cleaned = e.target.value.replace(/[^0-9-]/g, '')
                  setCnic(cleaned)
                }}
                maxLength={15}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="cursor-pointer">
                <div className={`h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition ${cnicFront ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  {cnicFront ? <IoCheckmarkCircle size={28} className="text-primary" /> : <IoCloudUpload size={28} className="text-text-muted" />}
                  <span className="text-xs text-text-secondary">{cnicFront ? 'Front ✓' : 'CNIC Front *'}</span>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => setCnicFront(e.target.files?.[0] || null)} />
              </label>
              <label className="cursor-pointer">
                <div className={`h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition ${cnicBack ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  {cnicBack ? <IoCheckmarkCircle size={28} className="text-primary" /> : <IoCloudUpload size={28} className="text-text-muted" />}
                  <span className="text-xs text-text-secondary">{cnicBack ? 'Back ✓' : 'CNIC Back *'}</span>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => setCnicBack(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div>
              <label className="text-sm text-text-secondary mb-1.5 block">Certificates (optional)</label>
              <label className="cursor-pointer">
                <div className="h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center gap-2">
                  <IoCloudUpload size={22} className="text-text-muted" />
                  <span className="text-sm text-text-muted">{certificates.length > 0 ? `${certificates.length} file(s)` : 'Upload certificates'}</span>
                </div>
                <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={e => setCertificates(Array.from(e.target.files || []))} />
              </label>
            </div>
          </div>
        )}

        {/* Step 3 — Bio */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <label className="text-sm text-text-secondary mb-1.5 block">Tell customers about yourself</label>
              <textarea rows={5} placeholder="I have 5 years of experience in electrical work..." value={bio} onChange={e => setBio(e.target.value)} className="resize-none" />
              <p className="text-xs text-text-muted mt-1">{bio.length}/500</p>
            </div>
            <div className="card p-4 space-y-2">
              <p className="text-sm font-semibold text-text-primary">Registration Summary</p>
              <p className="text-xs text-text-secondary">Name: {name}</p>
              <p className="text-xs text-text-secondary">Phone: {phone}</p>
              <p className="text-xs text-text-secondary">City: {city}</p>
              <p className="text-xs text-text-secondary">Skills: {skills.join(', ')}</p>
              <p className="text-xs text-text-secondary">CNIC: {cnic}</p>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 space-y-3">
          {step < 3 ? (
            <button type="button" onClick={nextStep} className="btn-primary">Next</button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary">
              {loading ? 'Creating Account...' : 'Submit Registration'}
            </button>
          )}
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s - 1)} className="btn-ghost">Back</button>
          )}
        </div>
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
