import { useState } from 'react'
import { IoWarning, IoClose } from 'react-icons/io5'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { DISPUTE_REASONS, CUSTOMER_CANCEL_REASONS, WORKER_CANCEL_REASONS } from '../types'
import type { Job, DisputeType } from '../types'
import DisputeMediaPicker, { DisputeMedia } from './DisputeMediaPicker'
import toast from 'react-hot-toast'

interface Props {
  job: Job
  type: DisputeType
  onClose: () => void
  onSubmitted: (disputeId: string) => void
}

export default function RaiseDisputeModal({ job, type, onClose, onSubmitted }: Props) {
  const { user } = useAuth()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [media, setMedia] = useState<DisputeMedia>({})
  const [submitting, setSubmitting] = useState(false)

  const isWorkerRaising = user?.id === job.worker_id
  const isCancellation = type === 'cancellation'
  const reasonList = isCancellation
    ? (isWorkerRaising ? WORKER_CANCEL_REASONS : CUSTOMER_CANCEL_REASONS)
    : DISPUTE_REASONS
  const newJobStatus = isCancellation ? 'cancellationRequested' : 'disputed'

  const submit = async () => {
    if (!reason) return toast.error('Please select a reason')
    if (!user) return
    setSubmitting(true)
    try {
      const fullReason = details.trim() ? `${reason}: ${details.trim()}` : reason
      const raiserName = isWorkerRaising ? job.worker_name : job.customer_name
      const otherPartyId = isWorkerRaising ? job.customer_id : job.worker_id

      const { data: dispute, error } = await supabase
        .from('disputes')
        .insert({
          job_id: job.id, raised_by: user.id, reason: fullReason, type,
          status_before: job.status,
          photo_url: media.photo_url, voice_url: media.voice_url, video_url: media.video_url,
        })
        .select()
        .single()
      if (error) throw error

      await supabase.from('jobs').update({
        status: newJobStatus,
        dispute_id: dispute.id,
        paused_at: new Date().toISOString(),
      }).eq('id', job.id)

      const actionLabel = isCancellation ? 'requested cancellation of' : 'raised a dispute on'
      const notifyTargets: { user_id: string; type: 'system'; title: string; body: string }[] = []
      if (otherPartyId) {
        notifyTargets.push({
          user_id: otherPartyId,
          type: 'system',
          title: isCancellation ? 'Cancellation Requested on Job' : 'Dispute Raised on Job',
          body: `${isWorkerRaising ? 'The worker' : 'The customer'} ${actionLabel} "${job.title}". The job is paused pending admin review.`,
        })
      }
      const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin')
      admins?.forEach(a => notifyTargets.push({
        user_id: a.id,
        type: 'system',
        title: isCancellation ? 'New Cancellation Request' : 'New Dispute Raised',
        body: `${raiserName} ${actionLabel} "${job.title}": ${reason}`,
      }))
      if (notifyTargets.length) await supabase.from('notifications').insert(notifyTargets)

      toast.success(isCancellation
        ? 'Cancellation request submitted. Our team will review it shortly.'
        : 'Dispute submitted. Our team will review it shortly.')
      onSubmitted(dispute.id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit. Please try again.')
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
            <h3 className="text-lg font-semibold text-text-primary">{isCancellation ? 'Request Cancellation' : 'Raise a Dispute'}</h3>
          </div>
          <button onClick={onClose}><IoClose size={22} className="text-text-muted" /></button>
        </div>
        <p className="text-xs text-text-muted mb-4">
          {isCancellation
            ? 'The job will be paused. Your funds will be locked in escrow — Customer Service will review the case and take action accordingly.'
            : 'The job will be paused and funds held in escrow until our team reviews and resolves this dispute.'}
        </p>

        {/* Auto-fetched job details */}
        <div className="bg-surface rounded-xl p-4 mb-4 space-y-1.5">
          <p className="text-sm font-semibold text-text-primary">{job.title}</p>
          <p className="text-xs text-text-secondary">{job.category} · {job.location}</p>
          {isWorkerRaising
            ? <p className="text-xs text-text-secondary">Customer: {job.customer_name}</p>
            : job.worker_name && <p className="text-xs text-text-secondary">Worker: {job.worker_name}</p>}
          <p className="text-xs text-text-muted">Job ID: {job.id.slice(0, 8)}</p>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-text-primary mb-1.5 block">Reason *</label>
          <select value={reason} onChange={e => setReason(e.target.value)} className={!reason ? 'text-text-muted' : ''}>
            <option value="">Select a reason</option>
            {reasonList.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="mb-5">
          <label className="text-sm font-medium text-text-primary mb-1.5 block">
            {isCancellation ? 'Describe the reason' : 'Additional Details'} <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            placeholder="Add any extra details that will help our team..."
            value={details}
            onChange={e => setDetails(e.target.value)}
            className="resize-none"
          />
        </div>

        <div className="mb-5">
          <label className="text-sm font-medium text-text-primary mb-1.5 block">
            Evidence <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <DisputeMediaPicker pathPrefix={`disputes/${job.id}`} media={media} onChange={setMedia} />
        </div>

        {isCancellation && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
            <p className="text-xs text-amber-800">
              ⚠️ Your funds will be locked. Customer Service will review the case and take action accordingly.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <button onClick={submit} disabled={submitting || !reason}
            className="w-full py-3.5 bg-red-500 text-white rounded-2xl text-sm font-semibold disabled:opacity-50">
            {submitting ? 'Submitting...' : isCancellation ? 'Submit Cancellation Request' : 'Submit Dispute'}
          </button>
          <button onClick={onClose} className="w-full py-2 text-xs text-text-muted">Cancel</button>
        </div>
      </div>
    </div>
  )
}
