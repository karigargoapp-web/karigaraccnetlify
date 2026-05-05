import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoHome, IoBriefcase, IoWallet, IoPerson, IoLocation, IoCalendar, IoCash, IoChatbubbleEllipses } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import NotificationBell from '../../components/NotificationBell'
import { SERVICE_CATEGORIES } from '../../types'
import type { Job, WorkerProfile as WP } from '../../types'

export default function WorkerDashboard() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [profile, setProfile] = useState<WP | null>(null)
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState('home')
  const [loading, setLoading] = useState(true)
  const [earnedNet, setEarnedNet] = useState(0)

  useEffect(() => {
    if (!user) return
    const loadAll = async () => {
      const [jobsRes, profileRes, activeRes, completedRes] = await Promise.all([
        supabase.from('jobs').select('*').eq('status', 'pending').eq('city', user.city || '').order('created_at', { ascending: false }),
        supabase.from('worker_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('jobs').select('*').eq('worker_id', user.id).neq('status', 'completed').neq('status', 'cancelled').limit(1).maybeSingle(),
        supabase.from('jobs').select('inspection_charges,work_cost,platform_fee').eq('worker_id', user.id).eq('status', 'completed'),
      ])
      if (jobsRes.data) setJobs(jobsRes.data as Job[])
      if (profileRes.data) setProfile(profileRes.data as WP)
      if (activeRes.data) setActiveJob(activeRes.data as Job)
      if (completedRes.data) {
        const net = completedRes.data.reduce((sum, j) => {
          const gross = (j.inspection_charges || 0) + (j.work_cost || 0)
          return sum + gross - (j.platform_fee || 0)
        }, 0)
        setEarnedNet(net)
      }
      setLoading(false)
    }
    loadAll()

    // Real-time: new pending jobs appear instantly; only show jobs in worker's city
    const workerCity = user.city || ''
    const channel = supabase
      .channel(`worker-jobs-feed-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'jobs', filter: 'status=eq.pending' },
        (payload) => {
          const newJob = payload.new as Job
          if (newJob.city && workerCity && newJob.city !== workerCity) return
          setJobs(prev => {
            if (prev.some(j => j.id === newJob.id)) return prev
            return [newJob, ...prev]
          })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs' },
        (payload) => {
          const updated = payload.new as Job
          if (updated.status !== 'pending') {
            // Remove from available list if no longer pending
            setJobs(prev => prev.filter(j => j.id !== updated.id))
          } else {
            // Update in place if still pending
            setJobs(prev => prev.map(j => j.id === updated.id ? updated : j))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'jobs' },
        (payload) => {
          setJobs(prev => prev.filter(j => j.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const filtered = filter ? jobs.filter(j => j.category === filter) : jobs

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="top-bar">
        <p className="text-white text-lg font-medium text-center mb-5">KarigarGo</p>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-sm">Welcome back,</p>
            <p className="text-white text-xl font-medium">{user?.name || 'Worker'} 👋</p>
            {profile?.skills && profile.skills.length > 0 && (
              <p className="text-white/50 text-xs mt-0.5">Skills: {profile.skills.join(', ')}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={() => nav('/worker/profile')}>
              <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-white/20 flex items-center justify-center">
                {user?.profile_photo_url ? (
                  <img src={user.profile_photo_url} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-lg">
                    {(user?.name || 'W').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3">
          <div className="flex-1 bg-white/10 rounded-xl p-3">
            <p className="text-white/60 text-xs mb-1">Available</p>
            <p className="text-white text-lg font-semibold">{jobs.length}</p>
          </div>
          <div className="flex-1 bg-white/10 rounded-xl p-3">
            <p className="text-white/60 text-xs mb-1">Jobs Done</p>
            <p className="text-white text-lg font-semibold">{profile?.total_jobs || 0}</p>
          </div>
          <div className="flex-1 bg-white/10 rounded-xl p-3">
            <p className="text-white/60 text-xs mb-1">Earned</p>
            <p className="text-white text-lg font-semibold">₨{earnedNet.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-24">
        {/* Active job banner */}
        {activeJob && (
          <button
            onClick={() => nav(`/worker/active-job/${activeJob.id}`)}
            className="w-full card p-4 mb-4 border-l-4 border-primary text-left"
          >
            <p className="text-xs text-primary font-semibold">ACTIVE JOB</p>
            <p className="text-sm font-medium text-text-primary mt-1">{activeJob.title}</p>
            <p className="text-xs text-text-muted">{activeJob.customer_name} · {activeJob.location}</p>
          </button>
        )}

        {/* Category filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-none mb-4">
          <button
            onClick={() => setFilter('')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              !filter ? 'bg-primary text-white' : 'bg-white border border-border text-text-secondary'
            }`}
          >
            All Categories
          </button>
          {SERVICE_CATEGORIES.map(c => (
            <button
              key={c.name}
              onClick={() => setFilter(c.name === filter ? '' : c.name)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                filter === c.name ? 'bg-primary text-white' : 'bg-white border border-border text-text-secondary'
              }`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {/* Jobs header */}
        <div className="flex items-center justify-between mb-3">
          <p className="section-title !mb-0">Jobs for Your Skills</p>
          <p className="text-xs text-text-muted">{filtered.length} jobs</p>
        </div>

        {/* Jobs list */}
        {loading ? (
          <p className="text-center text-sm text-text-muted py-8">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-4xl mb-3">💼</p>
            <p className="text-sm font-medium text-text-primary">No jobs available</p>
            <p className="text-xs text-text-muted mt-1">Jobs matching your registered skills will appear here</p>
          </div>
        ) : (
          filtered.map(job => (
            <div key={job.id} className="card mb-3 overflow-hidden">
              <div className="p-4">
                {/* Title + category badge */}
                <div className="flex items-start gap-2 mb-2">
                  <p className="text-sm font-medium text-text-primary flex-1">{job.title}</p>
                  <span className="shrink-0 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[11px] font-medium">
                    {job.category}
                  </span>
                </div>
                <p className="text-xs text-text-secondary line-clamp-2 mb-3">{job.description}</p>

                {/* Details row */}
                <div className="flex flex-wrap gap-3 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <IoCash size={14} className="text-text-muted" /> PKR {Number(job.budget).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <IoLocation size={14} className="text-text-muted" /> {job.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <IoCalendar size={14} className="text-text-muted" /> {job.date ? new Date(job.date).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>

              {/* Footer — customer info + view button */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-surface">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-white text-xs font-medium">{job.customer_name?.[0] || 'C'}</span>
                  </div>
                  <span className="text-xs text-text-secondary">{job.customer_name}</span>
                </div>
                <button
                  onClick={() => nav(`/worker/job/${job.id}`)}
                  className="px-4 py-1.5 bg-primary text-white text-xs font-medium rounded-xl active:scale-[0.97] transition"
                >
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom nav */}
      <div className="bottom-nav fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px]">
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
          <IoHome size={22} /> Jobs
        </button>
        <button className={tab === 'bids' ? 'active' : ''} onClick={() => { setTab('bids'); nav('/worker/my-bids') }}>
          <IoBriefcase size={22} /> My Jobs
        </button>
        <button className={tab === 'messages' ? 'active' : ''} onClick={() => { setTab('messages'); nav('/worker/messages') }}>
          <IoChatbubbleEllipses size={22} /> Messages
        </button>
        <button className={tab === 'earn' ? 'active' : ''} onClick={() => { setTab('earn'); nav('/worker/earnings') }}>
          <IoWallet size={22} /> Earnings
        </button>
        <button className={tab === 'profile' ? 'active' : ''} onClick={() => { setTab('profile'); nav('/worker/profile') }}>
          <IoPerson size={22} /> Profile
        </button>
      </div>
    </div>
  )
}
