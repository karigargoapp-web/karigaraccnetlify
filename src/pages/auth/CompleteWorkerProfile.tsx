import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoCheckmarkCircle, IoCloudUpload } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { WORKER_SKILL_CATEGORIES, PAKISTAN_CITIES } from '../../types'
import {
  formatCNICDisplay,
  normalizePhone,
  phoneVariants,
  validateCNIC,
  validateImageFile,
  validatePakistanPhone,
} from '../../lib/validation'
import { MAX_WORKER_SKILLS } from '../../lib/skills'
import { uploadPublic, withTimeout } from '../../lib/image'
import FieldError from '../../components/FieldError'
import toast from 'react-hot-toast'

const STEPS = ['Skills & City', 'Documents']

export default function CompleteWorkerProfile() {
  const nav = useNavigate()
  const { user, refreshUser } = useAuth()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const lockRef = useRef(false)

  const [skills, setSkills] = useState<string[]>([])
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [cnic, setCnic] = useState('')
  const [cnicFront, setCnicFront] = useState<File | null>(null)
  const [cnicBack, setCnicBack] = useState<File | null>(null)

  const clearError = (key: string) => setErrors(p => (p[key] ? { ...p, [key]: '' } : p))

  const toggleSkill = (s: string) => {
    setSkills(prev => {
      if (prev.includes(s)) return prev.filter(x => x !== s)
      if (prev.length >= MAX_WORKER_SKILLS) {
        setErrors(p => ({ ...p, skills: `You can select a maximum of ${MAX_WORKER_SKILLS} skills` }))
        return prev
      }
      clearError('skills')
      return [...prev, s]
    })
  }

  const validateStep = (s: number) => {
    const next: Record<string, string> = {}
    if (s === 0) {
      if (skills.length === 0) next.skills = 'Select at least one skill'
      if (!city) next.city = 'Please select your city'
      const ph = validatePakistanPhone(phone, { optional: false }); if (ph) next.phone = ph
    }
    if (s === 1) {
      const c = validateCNIC(cnic); if (c) next.cnic = c
      const f = validateImageFile(cnicFront, { required: true }); if (f) next.cnicFront = f
      const b = validateImageFile(cnicBack, { required: true }); if (b) next.cnicBack = b
    }
    return next
  }

  const nextStep = () => {
    const next = validateStep(0)
    setErrors(next)
    if (Object.keys(next).length === 0) setStep(1)
  }

  const handleSubmit = async () => {
    const next = validateStep(1)
    setErrors(next)
    if (Object.keys(next).length > 0 || !user) return
    if (lockRef.current) return
    lockRef.current = true
    setLoading(true)

    try {
      const phoneForDb = normalizePhone(phone)
      const { data: existing } = await withTimeout(
        supabase.from('users').select('id').in('phone', phoneVariants(phone)).neq('id', user.id).limit(1),
      )
      if (existing && existing.length > 0) {
        setErrors({ phone: 'This phone number is already registered with another account.' })
        setStep(0)
        return
      }

      const ts = Date.now()
      const [cnicFrontUrl, cnicBackUrl] = await Promise.all([
        uploadPublic('signup-docs', `cnic/${user.id}_${ts}_front.jpg`, cnicFront!),
        uploadPublic('signup-docs', `cnic/${user.id}_${ts}_back.jpg`, cnicBack!),
      ])

      const [usersRes, profileRes] = await withTimeout(Promise.all([
        supabase.from('users').update({ city, phone: phoneForDb, profile_complete: true }).eq('id', user.id),
        supabase.rpc('handle_signup_worker_profile', {
          p_user_id: user.id, p_skills: skills, p_bio: null,
          p_cnic: formatCNICDisplay(cnic), p_cnic_front_url: cnicFrontUrl, p_cnic_back_url: cnicBackUrl,
          p_certificate_urls: null,
        }),
      ]))
      if (usersRes.error) throw usersRes.error
      if (profileRes.error) throw profileRes.error

      await refreshUser()
      nav('/worker/pending-approval', { replace: true })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message || ''
      if (msg.includes('phone_unique')) {
        setErrors({ phone: 'This phone number is already registered with another account.' })
        setStep(0)
      } else {
        toast.error(msg || 'Something went wrong. Try again.')
      }
    } finally {
      setLoading(false)
      lockRef.current = false
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-primary px-6 pt-10 pb-6 rounded-b-3xl">
        <p className="text-white text-xl font-bold mb-1 text-center">Complete Your Profile</p>
        <div className="flex justify-center gap-4 mt-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition ${i <= step ? 'bg-white text-primary' : 'bg-white/20 text-white/50'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <p className={`text-[10px] ${i <= step ? 'text-white' : 'text-white/40'}`}>{s}</p>
            </div>
          ))}
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-3 mx-6 mt-5 bg-surface rounded-2xl px-4 py-3">
          {user.profile_photo_url ? (
            <img src={user.profile_photo_url} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-lg">{user.name?.[0]}</span>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-text-primary">{user.name}</p>
            <p className="text-xs text-text-muted">{user.email}</p>
          </div>
        </div>
      )}

      <div className="flex-1 px-6 py-5 overflow-y-auto pb-10 space-y-5">
        {step === 0 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <label className="section-title">Select Your Skills (Max {MAX_WORKER_SKILLS}) *</label>
              <p className="text-xs text-text-muted">{skills.length}/{MAX_WORKER_SKILLS} selected</p>
              <div className={`grid grid-cols-2 gap-2 mt-2 ${errors.skills ? 'p-1 rounded-xl border border-danger' : ''}`}>
                {WORKER_SKILL_CATEGORIES.map(cat => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => toggleSkill(cat.name)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm transition ${skills.includes(cat.name) ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-text-secondary'}`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                    {skills.includes(cat.name) && <IoCheckmarkCircle className="ml-auto text-primary" />}
                  </button>
                ))}
              </div>
              <FieldError message={errors.skills} />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">City *</label>
              <select value={city} onChange={e => { setCity(e.target.value); clearError('city') }}
                className={`${!city ? 'text-text-muted' : ''} ${errors.city ? 'field-error' : ''}`}>
                <option value="">Select city</option>
                {PAKISTAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <FieldError message={errors.city} />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Phone Number *</label>
              <input type="tel" placeholder="03001234567" value={phone} maxLength={11}
                onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 11)); clearError('phone') }}
                className={errors.phone ? 'field-error' : ''} />
              <FieldError message={errors.phone} />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            <div className="bg-surface rounded-2xl p-4 space-y-4">
              <p className="text-sm font-semibold text-text-primary">CNIC Verification *</p>
              <div>
                <label className="text-sm text-text-secondary mb-1.5 block">CNIC Number *</label>
                <input placeholder="12345-1234567-1" value={cnic} maxLength={15}
                  onChange={e => { setCnic(e.target.value.replace(/[^0-9-]/g, '')); clearError('cnic') }}
                  className={errors.cnic ? 'field-error' : ''} />
                <FieldError message={errors.cnic} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: 'cnicFront', file: cnicFront, set: setCnicFront, label: 'CNIC Front' },
                  { key: 'cnicBack', file: cnicBack, set: setCnicBack, label: 'CNIC Back' },
                ] as const).map(f => (
                  <div key={f.key}>
                    <label className="cursor-pointer block">
                      <div className={`h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition ${errors[f.key] ? 'border-danger bg-red-50' : f.file ? 'border-primary bg-primary/5' : 'border-border'}`}>
                        {f.file ? <IoCheckmarkCircle size={28} className="text-primary" /> : <IoCloudUpload size={28} className="text-text-muted" />}
                        <span className="text-xs text-text-secondary">{f.file ? `${f.label} ✓` : `${f.label} *`}</span>
                      </div>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => { f.set(e.target.files?.[0] || null); clearError(f.key) }} />
                    </label>
                    <FieldError message={errors[f.key]} />
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5 space-y-3">
              <p className="text-base font-semibold text-text-primary">Summary</p>
              <div className="flex justify-between text-sm"><span className="text-text-muted">City</span><span className="font-medium">{city}</span></div>
              <div className="flex justify-between text-sm"><span className="text-text-muted">Phone</span><span className="font-medium">{phone}</span></div>
              <div className="flex justify-between text-sm gap-3"><span className="text-text-muted">Skills</span><span className="font-medium text-right">{skills.join(', ')}</span></div>
            </div>
          </div>
        )}

        <div className="space-y-3 mt-2">
          {step === 0 ? (
            <button onClick={nextStep} className="btn-primary">Next</button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="btn-primary">
              {loading ? 'Saving…' : 'Complete Profile'}
            </button>
          )}
          {step > 0 && <button onClick={() => setStep(0)} className="btn-ghost">Back</button>}
        </div>
      </div>
    </div>
  )
}
