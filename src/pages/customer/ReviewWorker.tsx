import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoArrowBack, IoStar, IoStarOutline } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Job } from '../../types'
import toast from 'react-hot-toast'

const CRITERIA = [
  { key: 'quality', label: 'Work Quality', desc: 'How well was the job done?' },
  { key: 'punctuality', label: 'Punctuality', desc: 'Did the worker arrive and finish on time?' },
  { key: 'behaviour', label: 'Behaviour', desc: 'Was the worker professional and respectful?' },
]

function StarRow({ label, desc, value, onChange }: { label: string; desc: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-text-primary">{label}</p>
        <div className="flex gap-1">
          {[1,2,3,4,5].map(i => (
            <button key={i} onClick={() => onChange(i)} className="transition active:scale-110">
              {i <= value ? <IoStar size={28} className="text-yellow-400" /> : <IoStarOutline size={28} className="text-gray-300" />}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-text-muted">{desc}</p>
    </div>
  )
}

export default function ReviewWorker() {
  const nav = useNavigate()
  const { jobId } = useParams()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [ratings, setRatings] = useState({ quality: 0, punctuality: 0, behaviour: 0 })
  const [comment, setComment] = useState('')
  const [wouldHireAgain, setWouldHireAgain] = useState(true)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!jobId) return
    supabase.from('jobs').select('*').eq('id', jobId).single().then(({ data }) => { if (data) setJob(data as Job) })
  }, [jobId])

  const avgRating = ratings.quality && ratings.punctuality && ratings.behaviour
    ? Math.round(((ratings.quality + ratings.punctuality + ratings.behaviour) / 3) * 10) / 10
    : 0

  const handleSubmit = async () => {
    if (!ratings.quality || !ratings.punctuality || !ratings.behaviour) return toast.error('Please rate all 3 criteria')
    if (!user || !job) return
    setLoading(true)
    try {
      const { error } = await supabase.from('reviews').insert({
        job_id: job.id,
        reviewer_id: user.id,
        reviewer_name: user.name,
        worker_id: job.worker_id,
        rating: avgRating,
        comment: comment.trim() || null,
        direction: 'customer_to_worker',
      })
      if (error) throw error
      const { data: reviews } = await supabase.from('reviews').select('rating').eq('worker_id', job.worker_id).eq('direction', 'customer_to_worker')
      if (reviews && reviews.length > 0) {
        const avg = reviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / reviews.length
        await supabase.from('worker_profiles').update({ avg_rating: Math.round(avg * 10) / 10, total_jobs: reviews.length }).eq('user_id', job.worker_id)
      }
      setSubmitted(true)
      setTimeout(() => nav('/customer/home'), 2000)
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
      <div className="text-center">
        <div className="w-24 h-24 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
          <IoStar size={48} className="text-yellow-400" />
        </div>
        <p className="text-lg font-semibold text-text-primary">Thank You!</p>
        <p className="text-sm text-text-muted mt-2">Your review has been submitted</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <div className="bg-primary px-6 pt-10 pb-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={() => nav(-1)}><IoArrowBack size={24} className="text-white" /></button>
          <h1 className="text-white text-xl font-medium">Rate Your Experience</h1>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
            {job?.worker_photo
              ? <img src={job.worker_photo} className="w-full h-full object-cover" alt="worker" />
              : <span className="text-2xl font-bold text-primary">{job?.worker_name?.[0] || 'W'}</span>}
          </div>
          <div>
            <p className="text-base font-semibold text-text-primary">{job?.worker_name || 'Worker'}</p>
            <p className="text-sm text-text-muted mt-0.5">{job?.title}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-base font-semibold text-text-primary mb-1">Rate on 3 Criteria</p>
          <p className="text-xs text-text-muted mb-3">All 3 are required</p>
          {CRITERIA.map(c => (
            <StarRow key={c.key} label={c.label} desc={c.desc}
              value={ratings[c.key as keyof typeof ratings]}
              onChange={v => setRatings(prev => ({ ...prev, [c.key]: v }))} />
          ))}
          {avgRating > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-xl text-center">
              <p className="text-xs text-text-muted">Overall Rating</p>
              <p className="text-2xl font-bold text-yellow-500">{avgRating} ★</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-text-primary mb-3">Write a Review (optional)</p>
          <textarea rows={4} placeholder="Share your experience with others..."
            maxLength={500} value={comment} onChange={e => setComment(e.target.value)}
            className="resize-none w-full border border-border rounded-xl p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary" />
          <p className="text-xs text-text-muted mt-1 text-right">{comment.length}/500</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">Would you hire this worker again?</p>
              <p className="text-xs text-text-muted mt-0.5">Help others make better decisions</p>
            </div>
            <button onClick={() => setWouldHireAgain(v => !v)}
              className={`w-12 h-6 rounded-full transition relative shrink-0 ml-4 ${wouldHireAgain ? 'bg-primary' : 'bg-gray-200'}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${wouldHireAgain ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        <button onClick={handleSubmit} disabled={loading || !avgRating}
          className={`btn-primary ${!avgRating ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {loading ? 'Submitting...' : 'Submit Review'}
        </button>
        <button onClick={() => nav('/customer/home')} className="w-full border border-border bg-white text-text-primary py-3.5 rounded-2xl text-sm font-medium shadow-sm">
          Skip for Now
        </button>
      </div>
    </div>
  )
}
