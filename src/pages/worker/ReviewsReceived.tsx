import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoStar } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Review, WorkerProfile } from '../../types'

export default function ReviewsReceived() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [profile, setProfile] = useState<WorkerProfile | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('reviews').select('*').eq('worker_id', user.id).order('created_at', { ascending: false }),
      supabase.from('worker_profiles').select('*').eq('user_id', user.id).single(),
    ]).then(([r, p]) => {
      if (r.data) setReviews(r.data as Review[])
      if (p.data) setProfile(p.data as WorkerProfile)
    })
  }, [user])

  const breakdown = [5,4,3,2,1].map(star => ({
    star, count: reviews.filter(r => r.rating === star).length,
    pct: reviews.length > 0 ? (reviews.filter(r => r.rating === star).length / reviews.length) * 100 : 0,
  }))

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="top-bar flex items-center gap-3">
        <button onClick={() => nav(-1)}><IoArrowBack size={22} className="text-white" /></button>
        <h1 className="text-lg font-semibold text-white">My Reviews</h1>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto">
        {/* Summary */}
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-text-primary">{profile?.avg_rating?.toFixed(1) || '0.0'}</p>
              <div className="flex gap-0.5 mt-1">{[1,2,3,4,5].map(i => <IoStar key={i} size={14} className={i <= (profile?.avg_rating || 0) ? 'star-filled' : 'star-empty'} />)}</div>
              <p className="text-xs text-text-muted mt-1">{reviews.length} reviews</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {breakdown.map(b => (
                <div key={b.star} className="flex items-center gap-2">
                  <span className="text-xs text-text-muted w-3">{b.star}</span>
                  <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden"><div className="h-full bg-rating rounded-full" style={{ width: `${b.pct}%` }} /></div>
                  <span className="text-xs text-text-muted w-6 text-right">{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* List */}
        {reviews.map(r => (
          <div key={r.id} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text-primary">{r.reviewer_name?.split(' ')[0]}</p>
              <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <IoStar key={i} size={12} className={i <= r.rating ? 'star-filled' : 'star-empty'} />)}</div>
            </div>
            {r.comment && <p className="text-xs text-text-secondary mt-1.5">{r.comment}</p>}
            <p className="text-[10px] text-text-muted mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
          </div>
        ))}
        {reviews.length === 0 && <div className="card p-6 text-center text-sm text-text-muted">No reviews yet</div>}
      </div>
    </div>
  )
}
