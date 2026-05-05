import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoHome, IoBriefcase, IoChatbubbleEllipses, IoPerson, IoAdd, IoCall, IoChatbubble, IoNotifications } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useI18n } from '../../lib/i18n'
import NotificationBell from '../../components/NotificationBell'
import type { Job } from '../../types'
import { SERVICE_CATEGORIES } from '../../types'

export default function CustomerHome() {
  const nav = useNavigate()
  const { user } = useAuth()
  const { t } = useI18n()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('home')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
      if (data) setJobs(data as Job[])
      setLoading(false)
    }
    fetch()
  }, [user])

  // Auto-scroll categories with smooth infinite loop
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    
    let animationId: number
    let pos = 0
    const speed = 0.5 // pixels per frame
    
    const animate = () => {
      pos += speed
      // Reset when we've scrolled through one set of duplicated items
      const singleSetWidth = el.scrollWidth / 3
      if (pos >= singleSetWidth) {
        pos = 0
      }
      el.scrollLeft = pos
      animationId = requestAnimationFrame(animate)
    }
    
    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [])

  const ongoing = jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled')
  const completed = jobs.filter(j => j.status === 'completed')

  const statusLabel = (s: string) => {
    if (s === 'pending') return <span className="pill-pending">Bidding</span>
    if (s === 'completed') return <span className="pill-completed">Completed</span>
    return <span className="pill-active">In Progress</span>
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top bar */}
      <div className="top-bar">
        <div className="flex items-center justify-center mb-1">
          <p className="text-white text-xl font-semibold">KarigarGo</p>
        </div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-white/70 text-sm">Hello,</p>
            <p className="text-white text-xl font-medium">{user?.name || 'User'} 👋</p>
          </div>
          <button onClick={() => nav('/customer/profile')}>
            <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-white/20">
              {user?.profile_photo_url ? (
                <img src={user.profile_photo_url} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-lg">
                  {user?.name?.[0]}
                </div>
              )}
            </div>
          </button>
        </div>
        <button
          onClick={() => nav('/customer/post-job')}
          className="w-full py-3.5 bg-white rounded-2xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition"
        >
          <IoAdd size={20} className="text-primary" />
          <span className="text-primary font-medium text-sm">{t('postAJob')}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-24">
        {/* Service Categories — auto-scrolling */}
        <p className="section-title">{t('serviceCategories')}</p>
        <div ref={scrollRef} className="flex gap-4 overflow-x-hidden pb-3 -mx-1 px-1">
          {[...SERVICE_CATEGORIES, ...SERVICE_CATEGORIES, ...SERVICE_CATEGORIES].map((cat, idx) => (
            <div key={`${cat.name}-${idx}`} className="flex flex-col items-center min-w-[64px]">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1.5 shadow-sm"
                style={{ backgroundColor: cat.color + '20' }}
              >
                <span className="text-2xl">{cat.icon}</span>
              </div>
              <span className="text-[11px] text-text-secondary text-center">{cat.name}</span>
            </div>
          ))}
        </div>

        {/* Ongoing Jobs */}
        <div className="flex items-center justify-between mt-6 mb-3">
          <p className="section-title !mb-0">{t('ongoingJobs')}</p>
          <button onClick={() => nav('/customer/my-jobs')} className="text-sm text-primary font-medium">{t('viewAll')}</button>
        </div>

        {loading ? (
          <div className="card p-6 text-center text-sm text-text-muted">Loading...</div>
        ) : ongoing.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">{t('noOngoingJobs')}</div>
        ) : (
          ongoing.slice(0, 3).map(job => (
            <div key={job.id} className="card mb-3 overflow-hidden">
              <button
                onClick={() => nav(job.status === 'pending' ? `/customer/job/${job.id}` : `/customer/active-job/${job.id}`)}
                className="p-4 w-full text-left"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{job.title}</p>
                    <p className="text-xs text-text-secondary mt-1">{job.worker_name || 'Awaiting bids'}</p>
                    <p className="text-xs text-text-muted mt-0.5">{job.category}</p>
                  </div>
                  {statusLabel(job.status)}
                </div>
              </button>
              {job.status !== 'pending' && job.worker_name && (
                <div className="flex gap-2 px-4 pb-4 pt-0">
                  <button
                    onClick={() => nav(`/chat/${job.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-primary text-white text-xs font-medium rounded-xl"
                  >
                    <IoChatbubble size={16} /> Message
                  </button>
                </div>
              )}
            </div>
          ))
        )}

        {/* Completed Jobs */}
        <div className="flex items-center justify-between mt-6 mb-3">
          <p className="section-title !mb-0">{t('completedJobs')}</p>
        </div>
        {completed.length === 0 ? (
          <div className="card p-6 text-center text-sm text-text-muted">{t('noCompletedJobs')}</div>
        ) : (
          completed.slice(0, 3).map(job => (
            <div key={job.id} className="card p-4 mb-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-text-primary">{job.title}</p>
                  <p className="text-xs text-text-secondary mt-1">{job.worker_name}</p>
                  <span className="pill-completed mt-1 inline-block">Completed</span>
                </div>
                <span className="text-xs text-text-muted">
                  {new Date(job.completed_at || job.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom nav */}
      <div className="bottom-nav fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px]">
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
          <IoHome size={22} /> {t('home')}
        </button>
        <button className={tab === 'jobs' ? 'active' : ''} onClick={() => { setTab('jobs'); nav('/customer/my-jobs') }}>
          <IoBriefcase size={22} /> {t('myJobs')}
        </button>
        <button className={tab === 'chat' ? 'active' : ''} onClick={() => { setTab('chat'); nav('/customer/messages') }}>
          <IoChatbubbleEllipses size={22} />
          {t('messages')}
        </button>
        <button className={tab === 'notifications' ? 'active' : ''} onClick={() => { setTab('notifications'); nav('/customer/notifications') }}>
          <div className="relative">
            <IoNotifications size={22} />
            <NotificationBell showBadgeOnly={true} />
          </div>
          {t('notifications')}
        </button>
        <button className={tab === 'profile' ? 'active' : ''} onClick={() => { setTab('profile'); nav('/customer/profile') }}>
          <IoPerson size={22} /> {t('profile')}
        </button>
      </div>
    </div>
  )
}
