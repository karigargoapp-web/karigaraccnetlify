import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { IoArrowBack, IoCheckmarkCircle, IoCloudUpload, IoCamera, IoLockClosed } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { WORKER_SKILL_CATEGORIES } from '../../types'
import { formatCNICDisplay, validateCNIC, validateImageFile } from '../../lib/validation'
import { MAX_WORKER_SKILLS } from '../../lib/skills'
import { uploadPublic, withTimeout } from '../../lib/image'
import FieldError from '../../components/FieldError'
import SignedImage from '../../components/SignedImage'
import toast from 'react-hot-toast'

interface Profile {
  skills: string[] | null
  cnic: string | null
  cnic_front_url: string | null
  cnic_back_url: string | null
}

const LABELS: Record<string, string> = {
  photo: 'Profile photo',
  cnic: 'CNIC number',
  cnic_front: 'CNIC front image',
  cnic_back: 'CNIC back image',
  skills: 'Skills',
}

export default function ResubmitProfile() {
  const nav = useNavigate()
  const { user, loading: authLoading, refreshUser } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const lockRef = useRef(false)

  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [cnic, setCnic] = useState('')
  const [cnicFront, setCnicFront] = useState<File | null>(null)
  const [cnicBack, setCnicBack] = useState<File | null>(null)
  const [skills, setSkills] = useState<string[]>([])

  useEffect(() => {
    if (!user) return
    supabase.from('worker_profiles').select('skills,cnic,cnic_front_url,cnic_back_url').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfile(data as Profile)
          setCnic(data.cnic || '')
          setSkills(data.skills || [])
        }
      })
  }, [user])

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-surface text-sm text-text-muted">Loading...</div>
  if (!user) return <Navigate to="/login/worker" replace />
  if (user.approval_status !== 'rejected') return <Navigate to="/worker/pending-approval" replace />

  const fields = user.rejection_fields && user.rejection_fields.length > 0
    ? user.rejection_fields
    : ['photo', 'cnic', 'cnic_front', 'cnic_back', 'skills']
  const needs = (k: string) => fields.includes(k)
  const clear = (k: string) => setErrors(p => (p[k] ? { ...p, [k]: '' } : p))

  const toggleSkill = (s: string) => {
    setSkills(prev => {
      if (prev.includes(s)) return prev.filter(x => x !== s)
      if (prev.length >= MAX_WORKER_SKILLS) {
        setErrors(p => ({ ...p, skills: `You can select a maximum of ${MAX_WORKER_SKILLS} skills` }))
        return prev
      }
      clear('skills')
      return [...prev, s]
    })
  }

  const handleSubmit = async () => {
    const next: Record<string, string> = {}
    if (needs('photo')) {
      if (!photo) next.photo = 'Please add a new profile photo'
      else { const e = validateImageFile(photo, { required: true }); if (e) next.photo = e }
    }
    if (needs('cnic')) { const e = validateCNIC(cnic); if (e) next.cnic = e }
    if (needs('cnic_front')) { const e = validateImageFile(cnicFront, { required: true }); if (e) next.cnic_front = e }
    if (needs('cnic_back')) { const e = validateImageFile(cnicBack, { required: true }); if (e) next.cnic_back = e }
    if (needs('skills') && skills.length === 0) next.skills = 'Select at least one skill'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    if (lockRef.current) return
    lockRef.current = true
    setLoading(true)
    try {
      const ts = Date.now()
      const [photoUrl, frontUrl, backUrl] = await Promise.all([
        needs('photo') && photo ? uploadPublic('avatars', `${user.id}_${ts}.jpg`, photo) : Promise.resolve(null),
        needs('cnic_front') && cnicFront ? uploadPublic('signup-docs', `cnic/${user.id}_${ts}_front.jpg`, cnicFront) : Promise.resolve(null),
        needs('cnic_back') && cnicBack ? uploadPublic('signup-docs', `cnic/${user.id}_${ts}_back.jpg`, cnicBack) : Promise.resolve(null),
      ])

      const { error } = await withTimeout(supabase.rpc('fn_worker_resubmit', {
        p_cnic: needs('cnic') ? formatCNICDisplay(cnic) : null,
        p_cnic_front_url: frontUrl,
        p_cnic_back_url: backUrl,
        p_photo_url: photoUrl,
        p_skills: needs('skills') ? skills : null,
      }))
      if (error) throw error

      await refreshUser()
      toast.success('Resubmitted. Support will review it shortly.')
      nav('/worker/pending-approval', { replace: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : (e as { message?: string })?.message || 'Could not resubmit. Try again.')
    } finally {
      setLoading(false)
      lockRef.current = false
    }
  }

  const ReadOnly = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between gap-3 bg-surface rounded-xl px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-sm text-text-primary truncate">{value || '—'}</p>
      </div>
      <IoLockClosed className="text-text-muted shrink-0" size={14} />
    </div>
  )

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-primary px-6 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/worker/pending-approval')}><IoArrowBack size={22} className="text-white" /></button>
          <h1 className="text-white text-lg font-semibold">Resubmit Documents</h1>
        </div>
      </div>

      <div className="flex-1 px-6 py-5 overflow-y-auto pb-10 space-y-5">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-1">Support asked you to fix:</p>
          <p className="text-sm text-red-700">{fields.map(f => LABELS[f]).filter(Boolean).join(', ')}</p>
          {user.rejection_reason && <p className="text-xs text-red-600 mt-2">Reason: {user.rejection_reason}</p>}
        </div>

        <div>
          <p className="text-sm font-semibold text-text-primary mb-2">Profile photo</p>
          {needs('photo') ? (
            <div className="flex items-center gap-4">
              <div className={`w-20 h-20 rounded-full border-2 border-dashed overflow-hidden flex items-center justify-center ${errors.photo ? 'border-danger bg-red-50' : 'border-border bg-surface'}`}>
                {photoPreview ? <img src={photoPreview} className="w-full h-full object-cover" /> : <IoCamera size={24} className="text-text-muted" />}
              </div>
              <label className="px-4 py-2 bg-primary text-white text-xs rounded-lg flex items-center gap-1.5 cursor-pointer">
                <IoCloudUpload size={14} /> Choose new photo
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setPhoto(f); setPhotoPreview(URL.createObjectURL(f)); clear('photo') }
                }} />
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-surface rounded-xl px-4 py-3">
              {user.profile_photo_url && <img src={user.profile_photo_url} className="w-10 h-10 rounded-full object-cover" />}
              <p className="text-sm text-text-primary flex-1">Current photo</p>
              <IoLockClosed className="text-text-muted" size={14} />
            </div>
          )}
          <FieldError message={errors.photo} />
        </div>

        <div>
          <p className="text-sm font-semibold text-text-primary mb-2">CNIC number</p>
          {needs('cnic') ? (
            <>
              <input placeholder="12345-1234567-1" value={cnic} maxLength={15}
                onChange={e => { setCnic(e.target.value.replace(/[^0-9-]/g, '')); clear('cnic') }}
                className={errors.cnic ? 'field-error' : ''} />
              <FieldError message={errors.cnic} />
            </>
          ) : <ReadOnly label="CNIC number" value={profile?.cnic || ''} />}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {([
            { key: 'cnic_front', label: 'CNIC front', file: cnicFront, set: setCnicFront, url: profile?.cnic_front_url },
            { key: 'cnic_back', label: 'CNIC back', file: cnicBack, set: setCnicBack, url: profile?.cnic_back_url },
          ] as const).map(f => (
            <div key={f.key}>
              <p className="text-sm font-semibold text-text-primary mb-2">{f.label}</p>
              {needs(f.key) ? (
                <>
                  <label className="cursor-pointer block">
                    <div className={`h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition ${errors[f.key] ? 'border-danger bg-red-50' : f.file ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      {f.file ? <IoCheckmarkCircle size={28} className="text-primary" /> : <IoCloudUpload size={28} className="text-text-muted" />}
                      <span className="text-xs text-text-secondary">{f.file ? 'Selected ✓' : 'Upload new'}</span>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={e => { f.set(e.target.files?.[0] || null); clear(f.key) }} />
                  </label>
                  <FieldError message={errors[f.key]} />
                </>
              ) : (
                <div className="relative h-28 rounded-xl overflow-hidden bg-surface">
                  {f.url && <SignedImage src={f.url} className="w-full h-full object-cover opacity-70" />}
                  <IoLockClosed className="absolute top-2 right-2 text-text-muted" size={14} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div>
          <p className="text-sm font-semibold text-text-primary mb-2">Skills (max {MAX_WORKER_SKILLS})</p>
          {needs('skills') ? (
            <>
              <div className={`grid grid-cols-2 gap-2 ${errors.skills ? 'p-1 rounded-xl border border-danger' : ''}`}>
                {WORKER_SKILL_CATEGORIES.map(cat => (
                  <button key={cat.name} type="button" onClick={() => toggleSkill(cat.name)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm transition ${skills.includes(cat.name) ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-text-secondary'}`}>
                    <span>{cat.name}</span>
                    {skills.includes(cat.name) && <IoCheckmarkCircle className="ml-auto text-primary" />}
                  </button>
                ))}
              </div>
              <FieldError message={errors.skills} />
            </>
          ) : <ReadOnly label="Skills" value={(profile?.skills || []).join(', ')} />}
        </div>

        <button onClick={handleSubmit} disabled={loading} className="btn-primary">
          {loading ? 'Submitting…' : 'Resubmit for review'}
        </button>
      </div>
    </div>
  )
}
