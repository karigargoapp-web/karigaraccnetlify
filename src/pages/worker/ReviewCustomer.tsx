import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoArrowBack, IoStar, IoStarOutline } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Job } from '../../types'
import toast from 'react-hot-toast'

export default function ReviewCustomer() {
  const nav = useNavigate()
  const { jobId } = useParams()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')
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
      job_id: job.id,
      reviewer_id: user.id,
      reviewer_name: user.name,
      customer_id: job.customer_id,
      rating,
      comment: feedback.trim() || null,
      review_type: 'worker_to_customer',
    })
    setLoading(false)
    setSubmitted(true)
    setTimeout(() => nav('/worker/dashboard'), 2000)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">✅</span>
          </div>
          <p className="text-lg font-semibold text-text-primary">Thanks for your feedback!</p>
          <p className="text-sm text-text-muted mt-2">Returning to dashboard...</p>
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
          <h1 className="text-white text-xl font-medium text-center flex-1 pr-8">Rate the Customer</h1>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        {/* Customer card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-primary/10 border-4 border-gray-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-primary">{job?.customer_name?.[0] || 'C'}</span>
          </div>
          <p className="text-lg font-semibold text-text-primary">{job?.customer_name || 'Customer'}</p>
          <p className="text-sm text-text-muted mt-1">Customer</p>
        </div>

        {/* Rating */}
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

        {/* Feedback text */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-text-primary mb-3">Leave Feedback (Optional)</p>
          <textarea
            rows={5}
            placeholder="Share your experience working with this customer..."
            maxLength={500}
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            className="resize-none w-full border border-border rounded-xl p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
          <p className="text-xs text-text-muted mt-1 text-right">{feedback.length}/500</p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || rating === 0}
          className={`btn-primary ${rating === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Submitting...' : 'Submit Review'}
        </button>
        <button
          onClick={() => nav('/worker/dashboard')}
          className="w-full border border-border bg-white text-text-primary py-3.5 rounded-2xl text-sm font-medium shadow-sm"
        >
          Review Later
        </button>
      </div>
    </div>
  )
}
