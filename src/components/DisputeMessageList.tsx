import { useAuth } from '../hooks/useAuth'
import DisputeMediaView from './DisputeMediaView'
import type { DisputeMessage, Job } from '../types'

interface Props {
  messages: DisputeMessage[]
  job: Job
}

export default function DisputeMessageList({ messages, job }: Props) {
  const { user } = useAuth()

  const labelFor = (m: DisputeMessage) => {
    if (m.sender_id === user?.id) return 'You'
    if (m.sender_role === 'admin') return 'Admin'
    if (m.sender_id === job.customer_id) return job.customer_name || 'Customer'
    if (m.sender_id === job.worker_id) return job.worker_name || 'Worker'
    return m.sender_role
  }

  const directedLabel = (m: DisputeMessage) => {
    if (!m.directed_to) return null
    if (m.directed_to === job.customer_id) return job.customer_name || 'Customer'
    if (m.directed_to === job.worker_id) return job.worker_name || 'Worker'
    return null
  }

  if (messages.length === 0) {
    return <p className="text-xs text-text-muted text-center py-4">No remarks yet.</p>
  }

  return (
    <div className="space-y-3">
      {messages.map(m => (
        <div key={m.id} className={`rounded-xl p-3 border ${m.sender_role === 'admin' ? 'bg-amber-50 border-amber-200' : 'bg-surface border-border'}`}>
          <div className="flex items-center justify-between mb-1">
            <p className={`text-xs font-semibold ${m.sender_role === 'admin' ? 'text-amber-800' : 'text-text-primary'}`}>
              {labelFor(m)}{m.sender_role === 'admin' ? ' (Admin)' : ''}
            </p>
            <p className="text-[10px] text-text-muted">{new Date(m.created_at).toLocaleString()}</p>
          </div>
          {m.sender_role === 'admin' && directedLabel(m) && (
            <p className="text-[11px] text-amber-700 mb-1">Requested a response from {directedLabel(m)}</p>
          )}
          {m.message && <p className="text-sm text-text-secondary whitespace-pre-wrap">{m.message}</p>}
          <DisputeMediaView photo_url={m.photo_url} voice_url={m.voice_url} video_url={m.video_url} />
        </div>
      ))}
    </div>
  )
}
