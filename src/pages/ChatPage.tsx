import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoArrowBack } from 'react-icons/io5'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import ChatWindow from '../components/ChatWindow'
import type { Job } from '../types'

const STATUS_FLOW = [
  'pending',
  'bidAccepted',
  'inspectionDone',
  'workCostProposed',
  'workCostAccepted',
  'completed',
] as const

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bidding',
  bidAccepted: 'Worker Assigned',
  inspectionDone: 'Inspected',
  workCostProposed: 'Cost Proposed',
  workCostAccepted: 'Cost Approved',
  workCostRejected: 'Cost Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500',
  bidAccepted: 'bg-blue-500',
  inspectionDone: 'bg-purple-500',
  workCostProposed: 'bg-orange-500',
  workCostAccepted: 'bg-emerald-500',
  workCostRejected: 'bg-red-500',
  completed: 'bg-green-600',
  cancelled: 'bg-gray-500',
}

export default function ChatPage() {
  const nav = useNavigate()
  const { jobId } = useParams<{ jobId: string }>()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)

  useEffect(() => {
    if (!jobId) return
    supabase
      .from('jobs')
      .select('id, title, worker_name, customer_name, worker_id, customer_id, status')
      .eq('id', jobId)
      .single()
      .then(({ data }) => {
        if (data) setJob(data as Job)
      })

    const ch = supabase
      .channel(`chat-job-status-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,
        },
        payload => setJob(prev => (prev ? ({ ...prev, ...payload.new } as Job) : prev))
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [jobId])

  const otherName =
    user?.role === 'customer' ? job?.worker_name || 'Worker' : job?.customer_name || 'Customer'

  const statusIdx = job ? (STATUS_FLOW as readonly string[]).indexOf(job.status) : -1

  return (
    <div className="min-h-screen bg-surface flex flex-col" style={{ height: '100dvh' }}>
      <div className="top-bar flex items-center gap-3 shrink-0">
        <button onClick={() => nav(-1)}>
          <IoArrowBack size={22} className="text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-white leading-tight truncate">
            {job?.title || 'Chat'}
          </h1>
          <p className="text-white/70 text-xs">{otherName}</p>
        </div>
      </div>

      {job && (
        <div className="bg-white border-b border-border px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[job.status] || 'bg-gray-400'}`}
            />
            <p className="text-xs font-semibold text-text-primary">
              {STATUS_LABELS[job.status] || job.status}
            </p>
          </div>
          <div className="flex gap-0.5">
            {STATUS_FLOW.map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full ${i <= statusIdx ? 'bg-primary' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0">
        {jobId && <ChatWindow jobId={jobId} otherUserName={otherName} fullScreen />}
      </div>
    </div>
  )
}
