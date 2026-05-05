import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoCamera, IoChevronForward, IoLogOut, IoLockClosed, IoNotifications, IoHelpCircle, IoLanguage, IoPerson } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../lib/i18n'
import toast from 'react-hot-toast'

const NOTIF_KEY = 'karigargo_notif_popup_enabled'
function getNotifPref() {
  try { const v = localStorage.getItem(NOTIF_KEY); return v === null ? true : v === 'true' } catch { return true }
}

export default function CustomerProfile() {
  const nav = useNavigate()
  const { user, signOut, refreshUser } = useAuth()
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [city, setCity] = useState(user?.city || '')
  const [saving, setSaving] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState<boolean>(getNotifPref)

  const toggleNotif = () => {
    const next = !notifEnabled
    setNotifEnabled(next)
    try { localStorage.setItem(NOTIF_KEY, String(next)) } catch { }
    toast.success(next ? 'Notifications turned on' : 'Notifications turned off')
  }

  useEffect(() => {
    if (user) { setName(user.name); setPhone(user.phone || ''); setCity(user.city || '') }
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    await supabase.from('users').update({ name, phone, city }).eq('id', user.id)
    await refreshUser()
    setSaving(false)
    setEditing(false)
    toast.success('Profile updated')
  }

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const path = `avatars/${user.id}_${Date.now()}.jpg`
    await supabase.storage.from('avatars').upload(path, file)
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('users').update({ profile_photo_url: data.publicUrl }).eq('id', user.id)
    await refreshUser()
    toast.success('Photo updated')
  }

  const handleChangePassword = () => {
    nav('/customer/change-password')
  }

  const handleLogout = async () => {
    await signOut()
    nav('/login')
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Green header */}
      <div className="bg-primary px-6 pt-10 pb-6 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => nav('/customer/home')}>
            <IoArrowBack size={24} className="text-white" />
          </button>
          <h1 className="text-white text-xl font-medium">{t('profile')}</h1>
        </div>

        {/* Avatar + info */}
        <div className="flex items-center gap-4">
          <label className="cursor-pointer relative shrink-0">
            <div className="w-20 h-20 rounded-full border-4 border-white overflow-hidden bg-white/20 flex items-center justify-center">
              {user?.profile_photo_url
                ? <img src={user.profile_photo_url} className="w-full h-full object-cover" alt="avatar" />
                : <span className="text-3xl font-bold text-white">{user?.name?.[0] || 'U'}</span>}
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow">
              <IoCamera size={13} className="text-primary" />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </label>
          <div className="flex-1">
            <p className="text-white text-lg font-semibold">{user?.name}</p>
            <p className="text-white/70 text-sm mt-0.5">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        {/* Personal Information Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <p className="text-base font-semibold text-text-primary px-5 pt-4 pb-3">{t('personalInfo')}</p>

          {/* Personal Info Row */}
          <button
            onClick={() => nav('/customer/personal-info')}
            className="w-full flex items-center justify-between px-5 py-3.5 border-t border-border"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <IoPerson size={18} className="text-blue-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">{t('personalInfo')}</p>
                <p className="text-xs text-text-muted">{t('name')}, {t('city')}, Email</p>
              </div>
            </div>
            <IoChevronForward className="text-text-muted" />
          </button>

          {/* Change Password Row */}
          <button
            onClick={handleChangePassword}
            className="w-full flex items-center justify-between px-5 py-3.5 border-t border-border"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
                <IoLockClosed size={17} className="text-yellow-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">{t('changePassword')}</p>
                <p className="text-xs text-text-muted">{t('updatePassword')}</p>
              </div>
            </div>
            <IoChevronForward className="text-text-muted" />
          </button>
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <p className="text-base font-semibold text-text-primary px-5 pt-4 pb-3">{t('preferences')}</p>
          
          {/* Notifications Toggle */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
                <IoNotifications size={18} className="text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{t('notifications')}</p>
                <p className="text-xs text-text-muted">{t('receiveJobUpdates')}</p>
              </div>
            </div>
            {/* Toggle Switch */}
            <button onClick={toggleNotif} className={`w-11 h-6 rounded-full flex items-center transition-colors duration-200 px-0.5 ${notifEnabled ? 'bg-primary justify-end' : 'bg-gray-300 justify-start'}`}>
              <div className="w-5 h-5 bg-white rounded-full shadow" />
            </button>
          </div>

          {/* Language */}
          <button
            onClick={() => nav('/language')}
            className="w-full flex items-center justify-between px-5 py-3.5 border-t border-border"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <IoLanguage size={18} className="text-blue-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">{t('language')}</p>
                <p className="text-xs text-text-muted">{t('english')}</p>
              </div>
            </div>
            <IoChevronForward className="text-text-muted" />
          </button>
        </div>

        {/* Support */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <p className="text-base font-semibold text-text-primary px-5 pt-4 pb-3">{t('support')}</p>
          <button 
            onClick={() => nav('/help-support')}
            className="w-full flex items-center justify-between px-5 py-3.5 border-t border-border"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <IoHelpCircle size={19} className="text-red-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">{t('helpSupport')}</p>
                <p className="text-xs text-text-muted">{t('faqsAndContact')}</p>
              </div>
            </div>
            <IoChevronForward className="text-text-muted" />
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-white border border-red-200 text-red-500 py-4 rounded-2xl text-sm font-medium shadow-sm"
        >
          <IoLogOut size={18} /> {t('logout')}
        </button>
      </div>
    </div>
  )
}
