import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { PAKISTAN_CITIES } from '../../types'
import { normalizePhone, phoneVariants, validatePakistanPhone } from '../../lib/validation'
import FieldError from '../../components/FieldError'
import PhoneInput from '../../components/PhoneInput'
import toast from 'react-hot-toast'

export default function CompleteCustomerProfile() {
  const nav = useNavigate()
  const { user, refreshUser } = useAuth()

  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const lockRef = useRef(false)

  const handleSubmit = async () => {
    const next: Record<string, string> = {}
    if (!city) next.city = 'Please select your city'
    const phoneErr = validatePakistanPhone(phone, { optional: false })
    if (phoneErr) next.phone = phoneErr
    setErrors(next)
    if (Object.keys(next).length > 0 || !user) return

    if (lockRef.current) return
    lockRef.current = true
    setLoading(true)

    try {
      const phoneForDb = normalizePhone(phone)
      const { data: phoneTaken } = await supabase.rpc('fn_phone_exists', { p_phones: phoneVariants(phone) })
      if (phoneTaken === true) {
        setErrors({ phone: 'This phone number is already registered with another account.' })
        return
      }

      const { error } = await supabase
        .from('users')
        .update({ city, phone: phoneForDb, profile_complete: true })
        .eq('id', user.id)
      if (error) {
        if (error.message.includes('phone_unique') || error.message.includes('users_phone_unique')) {
          setErrors({ phone: 'This phone number is already registered with another account.' })
          return
        }
        throw error
      }

      await refreshUser()
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
        <p className="text-white/70 text-sm mt-1">Tell us where you are and how to reach you.</p>
      </div>

      <div className="flex-1 px-6 py-6 space-y-5 overflow-y-auto pb-10">
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

        <div>
          <label className="text-sm font-medium text-text-primary mb-1.5 block">City *</label>
          <select
            value={city}
            onChange={e => { setCity(e.target.value); setErrors(p => ({ ...p, city: '' })) }}
            className={`${!city ? 'text-text-muted' : ''} ${errors.city ? 'field-error' : ''}`}
          >
            <option value="">Select your city</option>
            {PAKISTAN_CITIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <FieldError message={errors.city} />
        </div>

        <div>
          <label className="text-sm font-medium text-text-primary mb-1.5 block">Phone Number *</label>
          <PhoneInput value={phone} onChange={v => { setPhone(v); setErrors(p => ({ ...p, phone: '' })) }} hasError={!!errors.phone} />
          {errors.phone ? <FieldError message={errors.phone} /> : <p className="text-xs text-text-muted mt-1">Format: 03XXXXXXXXX (11 digits)</p>}
        </div>

        <button onClick={handleSubmit} disabled={loading} className="btn-primary">
          {loading ? 'Saving…' : 'Complete Profile'}
        </button>
      </div>
    </div>
  )
}
