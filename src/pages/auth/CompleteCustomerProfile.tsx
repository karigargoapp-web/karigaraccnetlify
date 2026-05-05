import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoCheckmarkCircle, IoCloudUpload } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PAKISTAN_CITIES } from '../../types'
import {
  formatCNICDisplay,
  validateCNIC,
  validateImageFile,
} from '../../lib/validation'
import toast from 'react-hot-toast'

export default function CompleteCustomerProfile() {
  const nav = useNavigate()
  const { user, refreshUser } = useAuth()

  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [cnic, setCnic] = useState('')
  const [cnicFront, setCnicFront] = useState<File | null>(null)
  const [cnicBack, setCnicBack] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const lockRef = useRef(false)

  const uploadFile = async (file: File, folder: string) => {
    const path = `${folder}/${Date.now()}_${file.name}`
    await supabase.storage.from('signup-docs').upload(path, file)
    const { data } = supabase.storage.from('signup-docs').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSubmit = async () => {
    const err =
      (!city ? 'Please select your city' : null) ||
      (!phone || phone.length < 10 ? 'Please enter a valid phone number' : null) ||
      validateCNIC(cnic) ||
      validateImageFile(cnicFront, { required: true }) ||
      validateImageFile(cnicBack, { required: true })
    if (err) return toast.error(err)
    if (!user) return

    if (lockRef.current) return
    lockRef.current = true
    setLoading(true)

    try {
      const cnicFormatted = formatCNICDisplay(cnic)
      const cnicFrontUrl = await uploadFile(cnicFront!, 'cnic')
      const cnicBackUrl = await uploadFile(cnicBack!, 'cnic')

      const { error } = await supabase
        .from('users')
        .update({
          city: city || null,
          phone: phone || null,
          cnic: cnicFormatted,
          cnic_front_url: cnicFrontUrl,
          cnic_back_url: cnicBackUrl,
          profile_complete: true,
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshUser()
      toast.success('Profile completed!')
      nav('/customer/home', { replace: true })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
      lockRef.current = false
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="bg-primary px-6 pt-12 pb-8 rounded-b-3xl text-center">
        <img src="/logo.png" alt="KarigarGo" className="w-14 h-14 mx-auto mb-2 rounded-2xl" />
        <p className="text-white text-xl font-bold mt-2">One Last Step</p>
        <p className="text-white/70 text-sm mt-1">
          We need your CNIC to verify your identity.
        </p>
      </div>

      <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto pb-10">

        {/* Google profile preview */}
        {user && (
          <div className="flex items-center gap-3 bg-surface rounded-2xl px-4 py-3">
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

        {/* City */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-1.5 block">City *</label>
          <select
            value={city}
            onChange={e => setCity(e.target.value)}
            className={!city ? 'text-text-muted' : ''}
          >
            <option value="">Select your city</option>
            {PAKISTAN_CITIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Phone Number */}
        <div className="bg-surface rounded-2xl p-4 space-y-4">
          <p className="text-sm font-semibold text-text-primary">Contact Information *</p>
          
          <div>
            <label className="text-sm text-text-secondary mb-1.5 block">Phone Number *</label>
            <input
              type="tel"
              placeholder="03XX-XXXXXXX"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              maxLength={11}
            />
            <p className="text-xs text-text-muted mt-1">Format: 03XXXXXXXXX (11 digits)</p>
          </div>
        </div>

        {/* CNIC section */}
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
                {cnicFront
                  ? <IoCheckmarkCircle size={28} className="text-primary" />
                  : <IoCloudUpload size={28} className="text-text-muted" />
                }
                <span className="text-xs text-text-secondary">{cnicFront ? 'Front ✓' : 'CNIC Front *'}</span>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={e => setCnicFront(e.target.files?.[0] || null)} />
            </label>
            <label className="cursor-pointer">
              <div className={`h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition ${cnicBack ? 'border-primary bg-primary/5' : 'border-border'}`}>
                {cnicBack
                  ? <IoCheckmarkCircle size={28} className="text-primary" />
                  : <IoCloudUpload size={28} className="text-text-muted" />
                }
                <span className="text-xs text-text-secondary">{cnicBack ? 'Back ✓' : 'CNIC Back *'}</span>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={e => setCnicBack(e.target.files?.[0] || null)} />
            </label>
          </div>

          <p className="text-[11px] text-text-muted leading-snug">
            Your CNIC is required for identity verification and is kept secure.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Saving…' : 'Complete Profile'}
        </button>
      </div>
    </div>
  )
}
