import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoCheckmarkCircle, IoCloudUpload } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { SERVICE_CATEGORIES, PAKISTAN_CITIES } from '../../types'
import {
  formatCNICDisplay,
  validateCNIC,
  validateCertificateFile,
  validateImageFile,
  validatePakistanPhone,
  validateWorkerBio,
} from '../../lib/validation'
import toast from 'react-hot-toast'

const STEPS = ['Skills & City', 'Documents', 'Bio']

export default function CompleteWorkerProfile() {
  const nav = useNavigate()
  const { user, refreshUser } = useAuth()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const lockRef = useRef(false)

  // Step 0
  const [skills, setSkills] = useState<string[]>([])
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')

  // Step 1
  const [cnic, setCnic] = useState('')
  const [cnicFront, setCnicFront] = useState<File | null>(null)
  const [cnicBack, setCnicBack] = useState<File | null>(null)
  const [certificates, setCertificates] = useState<File[]>([])

  // Step 2
  const [bio, setBio] = useState('')

  const toggleSkill = (s: string) =>
    setSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const uploadFile = async (file: File, folder: string) => {
    const path = `${folder}/${Date.now()}_${file.name}`
    await supabase.storage.from('signup-docs').upload(path, file)
    const { data } = supabase.storage.from('signup-docs').getPublicUrl(path)
    return data.publicUrl
  }

  const nextStep = () => {
    if (step === 0) {
      if (skills.length === 0 || !city) return toast.error('Select at least one skill and a city')
      const phoneErr = validatePakistanPhone(phone, { optional: false })
      if (phoneErr) return toast.error(phoneErr)
    }
    if (step === 1) {
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
    setStep(s => Math.min(s + 1, 2))
  }

  const handleSubmit = async () => {
    const bioErr = validateWorkerBio(bio)
    if (bioErr) return toast.error(bioErr)
    if (!user) return

    if (lockRef.current) return
    lockRef.current = true
    setLoading(true)

    try {
      const cnicFormatted = formatCNICDisplay(cnic)
      const cnicFrontUrl = await uploadFile(cnicFront!, 'cnic')
      const cnicBackUrl = await uploadFile(cnicBack!, 'cnic')

      const certUrls: string[] = []
      for (const cert of certificates) certUrls.push(await uploadFile(cert, 'certificates'))

      const rawPhone = phone.trim()
      const phoneForDb = rawPhone.startsWith('0') ? '+92' + rawPhone.slice(1) : rawPhone

      const { error: usersErr } = await supabase
        .from('users')
        .update({ city, phone: phoneForDb, profile_complete: true })
        .eq('id', user.id)
      if (usersErr) throw usersErr

      const { error: profileErr } = await supabase
        .from('worker_profiles')
        .update({
          skills,
          bio: bio || null,
          cnic: cnicFormatted,
          cnic_front_url: cnicFrontUrl,
          cnic_back_url: cnicBackUrl,
          certificate_urls: certUrls.length > 0 ? certUrls : null,
        })
        .eq('user_id', user.id)
      if (profileErr) throw profileErr

      await refreshUser()
      toast.success('Profile completed!')
      nav('/worker/dashboard', { replace: true })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
      lockRef.current = false
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-primary px-6 pt-10 pb-6 rounded-b-3xl">
        <p className="text-white text-xl font-bold mb-1 text-center">Complete Your Profile</p>
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-3">
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

      {/* Google profile preview */}
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

        {/* Step 0 — Skills, city, phone */}
        {step === 0 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <label className="section-title">Select Your Skills *</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {SERVICE_CATEGORIES.map(cat => (
                  <button
                    key={cat.name}
                    onClick={() => toggleSkill(cat.name)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm transition ${skills.includes(cat.name) ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-text-secondary'}`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                    {skills.includes(cat.name) && <IoCheckmarkCircle className="ml-auto text-primary" />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">City *</label>
              <select value={city} onChange={e => setCity(e.target.value)} className={!city ? 'text-text-muted' : ''}>
                <option value="">Select city</option>
                {PAKISTAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Phone Number *</label>
              <input
                type="tel"
                placeholder="03001234567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 1 — Documents */}
        {step === 1 && (
          <div className="space-y-5 animate-fade-in">
            <div className="bg-surface rounded-2xl p-4 space-y-4">
              <p className="text-sm font-semibold text-text-primary">CNIC Verification *</p>
              <div>
                <label className="text-sm text-text-secondary mb-1.5 block">CNIC Number *</label>
                <input
                  placeholder="12345-1234567-1"
                  value={cnic}
                  onChange={e => setCnic(e.target.value)}
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
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Certificates <span className="text-text-muted font-normal">(optional)</span></label>
              <label className="cursor-pointer">
                <div className="h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center gap-2">
                  <IoCloudUpload size={22} className="text-text-muted" />
                  <span className="text-sm text-text-muted">
                    {certificates.length > 0 ? `${certificates.length} file(s) selected` : 'Upload certificates'}
                  </span>
                </div>
                <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={e => setCertificates(Array.from(e.target.files || []))} />
              </label>
            </div>
          </div>
        )}

        {/* Step 2 — Bio */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 block">Tell customers about yourself</label>
              <textarea
                rows={5}
                placeholder="I have 5 years of experience in electrical work..."
                value={bio}
                onChange={e => setBio(e.target.value)}
                className="resize-none"
              />
              <p className="text-xs text-text-muted mt-1">{bio.length}/500</p>
            </div>
            <div className="card p-4 space-y-1">
              <p className="text-sm font-semibold text-text-primary mb-2">Summary</p>
              <p className="text-xs text-text-secondary">City: {city}</p>
              <p className="text-xs text-text-secondary">Skills: {skills.join(', ')}</p>
              <p className="text-xs text-text-secondary">CNIC: {formatCNICDisplay(cnic)}</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="space-y-3 mt-2">
          {step < 2 ? (
            <button onClick={nextStep} className="btn-primary">Next</button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="btn-primary">
              {loading ? 'Saving…' : 'Complete Profile'}
            </button>
          )}
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="btn-ghost">Back</button>
          )}
        </div>
      </div>
    </div>
  )
}
