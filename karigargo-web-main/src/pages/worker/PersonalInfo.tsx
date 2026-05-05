import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoPerson, IoMail, IoCall, IoLocation } from 'react-icons/io5'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../lib/i18n'

export default function WorkerPersonalInfo() {
  const nav = useNavigate()
  const { user } = useAuth()
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Green header */}
      <div className="bg-primary px-6 pt-10 pb-6 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={() => nav('/worker/profile')}>
            <IoArrowBack size={24} className="text-white" />
          </button>
          <h1 className="text-white text-xl font-medium">{t('personalInfo')}</h1>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        {/* Info Card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <p className="text-base font-semibold text-text-primary px-5 pt-4 pb-3">Your Details</p>
          
          {/* Name */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <IoPerson size={18} className="text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t('name')}</p>
                <p className="text-sm font-medium text-text-primary">{user?.name || '-'}</p>
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <IoMail size={18} className="text-green-500" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t('email')}</p>
                <p className="text-sm font-medium text-text-primary">{user?.email || '-'}</p>
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                <IoCall size={18} className="text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t('phone')}</p>
                <p className="text-sm font-medium text-text-primary">{user?.phone || '-'}</p>
              </div>
            </div>
          </div>

          {/* City */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                <IoLocation size={18} className="text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-text-muted">{t('city')}</p>
                <p className="text-sm font-medium text-text-primary">{user?.city || '-'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Message */}
        <div className="p-4 bg-[#e3f2fd] border border-[#90caf9] rounded-xl">
          <p className="text-sm text-[#1565c0]">
            This information was collected during registration and cannot be changed.
          </p>
        </div>
      </div>
    </div>
  )
}
