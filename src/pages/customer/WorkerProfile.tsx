import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoArrowBack, IoStar, IoCheckmarkCircle, IoChatbubble } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import type { User, WorkerProfile, Review } from '../../types'

export default function ViewWorkerProfile() {
  const nav = useNavigate()
  const { workerId } = useParams()
  const [worker, setWorker] = useState<User | null>(null)
  const [profile, setProfile] = useState<WorkerProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])  
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workerId) return
    const fetch = async () => {
      const [u, p, r] = await Promise.all([
        supabase.from('users').select('*').eq('id', workerId).maybeSingle(),
        supabase.from('worker_profiles').select('*').eq('user_id', workerId).maybeSingle(),
        supabase.from('reviews').select('*').eq('worker_id', workerId).order('created_at', { ascending: false }),
      ])
      if (u.data) setWorker(u.data as User)
      if (p.data) setProfile(p.data as WorkerProfile)
      if (r.data) setReviews(r.data as Review[])
      setLoading(false)
    }
    fetch()
  }, [workerId])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-surface text-sm text-text-muted">Loading...</div>
  if (!worker) return <div className="min-h-screen flex items-center justify-center bg-surface text-sm text-text-muted">Worker not found</div>

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="top-bar flex items-center gap-3">
        <button onClick={() => nav(-1)}><IoArrowBack size={22} className="text-white" /></button>
        <h1 className="text-lg font-semibold text-white">Worker Profile</h1>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto">
        {/* Profile card */}
        <div className="card p-5 text-center">
          <div className="w-20 h-20 rounded-full bg-surface border-2 border-primary flex items-center justify-center mx-auto mb-3 overflow-hidden">
            {worker.profile_photo_url ? <img src={worker.profile_photo_url} className="w-full h-full object-cover" /> :
              <span className="text-3xl font-bold text-primary">{worker.name[0]}</span>}
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <h2 className="text-lg font-semibold text-text-primary">{worker.name}</h2>
            {worker.verified && <IoCheckmarkCircle className="text-primary" size={18} />}
          </div>
          <p className="text-sm text-text-secondary">{worker.city}</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            <IoStar className="star-filled" size={16} />
            <span className="text-sm font-medium text-text-primary">{profile?.avg_rating?.toFixed(1) || '0.0'}</span>
            <span className="text-xs text-text-muted">({profile?.total_jobs || 0} jobs)</span>
          </div>
          {/* Skills */}
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {profile?.skills?.map(s => (
              <span key={s} className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full">{s}</span>
            ))}
          </div>
          {profile?.bio && <p className="text-sm text-text-secondary mt-3">{profile.bio}</p>}
        </div>

        {/* Reviews */}
        <div>
          <p className="section-title">Reviews ({reviews.length})</p>
          {reviews.length === 0 ? (
            <div className="card p-4 text-center text-sm text-text-muted">No reviews yet</div>
          ) : reviews.map(r => (
            <div key={r.id} className="card p-4 mb-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text-primary">{r.reviewer_name}</p>
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(i => <IoStar key={i} size={12} className={i <= r.rating ? 'star-filled' : 'star-empty'} />)}
                </div>
              </div>
              {r.comment && <p className="text-xs text-text-secondary mt-1.5">{r.comment}</p>}
              <p className="text-[10px] text-text-muted mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
