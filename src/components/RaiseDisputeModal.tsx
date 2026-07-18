import { useState } from 'react'
import { IoWarning, IoClose } from 'react-icons/io5'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { DISPUTE_REASONS } from '../types'
import type { Job } from '../types'
import toast from 'react-hot-toast'

interface Props {
  job: Job
  onClose: () => void
  onSubmitted: (disputeId: string) => void
}

export default function RaiseDisputeModal({ job, onClose, onSubmitted }: Props) {
  const { user } = useAuth()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!reason) return toast.error('Please select a reason')
    if (!user) return
    setSubmitting(true)
    try {
      const fullReason = details.trim() ? `${reason}: ${details.trim()}` : reason

      const { data: dispute, error } = await supabase
        .from('disputes')
        .insert({ job_id: job.id, raised_by: user.id, reason: fullReason })
        .select()
        .single()
      if (error) throw error

      await supabase.from('jobs').update({
        status: 'disputed',
        dispute_id: dispute.id,
        paused_at: new Date().toISOString(),
      }).eq('id', job.id)

      const notifyTargets: { user_id: string; type: 'system'; title: string; body: string }[] = []
      if (job.worker_id) {
        notifyTargets.push({
          user_id: job.worker_id,
          type: 'system',
          title: 'Dispute Raised on Job',
          body: `The customer raised a dispute on "${job.title}". The job is paused pending admin review.`,
        })
      }
      const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin')
      admins?.forEach(a => notifyTargets.push({
        user_id: a.id,
        type: 'system',
        title: 'New Dispute Raised',
        body: `${job.customer_name} raised a dispute on "${job.title}": ${reason}`,
      }))
      if (notifyTargets.length) await supabase.from('notifications').insert(notifyTargets)

      toast.success('Dispute submitted. Our team will review it shortly.')
      onSubmitted(dispute.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to raise dispute. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white w-full max-w-[430px] rounded-t-3xl p-6 max-h-[88vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
              <IoWarning size={18} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">Raise a Dispute</h3>
          </div>
          <button onClick={onClose}><IoClose size={22} className="text-text-muted" /></button>
        </div>
        <p className="text-xs text-text-muted mb-4">
          The job will be paused and funds held in escrow until our team reviews and resolves this dispute.
        </p>

        {/* Auto-fetched job details */}
        <div className="bg-surface rounded-xl p-4 mb-4 space-y-1.5">
          <p className="text-sm font-semibold text-text-primary">{job.title}</p>
          <p className="text-xs text-text-secondary">{job.category} · {job.location}</p>
          {job.worker_name && <p className="text-xs text-text-secondary">Worker: {job.worker_name}</p>}
          <p className="text-xs text-text-muted">Job ID: {job.id.slice(0, 8)}</p>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-text-primary mb-1.5 block">Reason *</label>
          <select value={reason} onChange={e => setReason(e.target.value)} className={!reason ? 'text-text-muted' : ''}>
            <option value="">Select a reason</option>
            {DISPUTE_REASONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="mb-5">
          <label className="text-sm font-medium text-text-primary mb-1.5 block">
            Additional Details <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            placeholder="Add any extra details that will help our team..."
            value={details}
            onChange={e => setDetails(e.target.value)}
            className="resize-none"
          />
        </div>

        <div className="space-y-2">
          <button onClick={submit} disabled={submitting || !reason}
            className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-semibold disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Dispute'}
          </button>
          <button onClick={onClose} className="w-full py-2 text-xs text-text-muted">Cancel</button>
        </div>
      </div>
    </div>
  )
}
