import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoArrowBack, IoStar, IoStarOutline } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Job } from '../../types'
import toast from 'react-hot-toast'

export default function ReviewWorker() {
  const nav = useNavigate()
  const { jobId } = useParams()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [wouldHireAgain, setWouldHireAgain] = useState(true)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!jobId) return
    supabase.from('jobs').select('*').eq('id', jobId).single().then(({ data }) => { if (data) setJob(data as Job) })
  }, [jobId])

  const ratingLabel = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating] || 'Tap to rate'

  const handleSubmit = async () => {
    if (rating === 0) return toast.error('Please select a rating')
    if (!user || !job) return
    setLoading(true)
    await supabase.from('reviews').insert({
      job_id: job.id, reviewer_id: user.id, reviewer_name: user.name,
      worker_id: job.worker_id, rating, comment: comment.trim() || null,
    })
    const { data: reviews } = await supabase.from('reviews').select('rating').eq('worker_id', job.worker_id)
    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / reviews.length
      await supabase.from('worker_profiles').update({ avg_rating: Math.round(avg * 10) / 10, total_jobs: reviews.length }).eq('user_id', job.worker_id)
    }
    setLoading(false)
    setSubmitted(true)
    setTimeout(() => { nav('/customer/home') }, 2000)
  }

  if (submitted) {
    return (
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
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Green header */}
      <div className="bg-primary px-6 pt-10 pb-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={() => nav(-1)}><IoArrowBack size={24} className="text-white" /></button>
          <h1 className="text-white text-xl font-medium">Rate Your Experience</h1>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        {/* Worker card */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-4">
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
        </div>

        {/* Stars */}
        <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
          <p className="text-base font-semibold text-text-primary mb-5">How was your experience?</p>
          <div className="flex justify-center gap-2 mb-3">
            {[1, 2, 3, 4, 5].map(i => (
              <button key={i} onClick={() => setRating(i)} className="transition active:scale-110">
                {i <= rating
                  ? <IoStar size={44} className="text-yellow-400" />
                  : <IoStarOutline size={44} className="text-gray-300" />}
              </button>
            ))}
          </div>
          <p className="text-sm text-text-muted">{ratingLabel}</p>
        </div>

        {/* Review text */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-text-primary mb-3">Write a Review</p>
          <textarea
            rows={4}
            placeholder="Share your experience with others..."
            maxLength={500}
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="resize-none w-full border border-border rounded-xl p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
          <p className="text-xs text-text-muted mt-1 text-right">{comment.length}/500</p>
        </div>

        {/* Would hire again toggle */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">Would you hire this worker again?</p>
              <p className="text-xs text-text-muted mt-0.5">Help others make better decisions</p>
            </div>
            <button
              onClick={() => setWouldHireAgain(v => !v)}
              className={`w-12 h-6 rounded-full transition relative shrink-0 ml-4 ${wouldHireAgain ? 'bg-primary' : 'bg-gray-200'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${wouldHireAgain ? 'left-[26px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Buttons */}
        <button
          onClick={handleSubmit}
          disabled={loading || rating === 0}
          className={`btn-primary ${rating === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Submitting...' : 'Submit Review'}
        </button>
        <button onClick={() => nav('/customer/home')} className="w-full border border-border bg-white text-text-primary py-3.5 rounded-2xl text-sm font-medium shadow-sm">
          Skip for Now
        </button>
      </div>
    </div>
  )
}
