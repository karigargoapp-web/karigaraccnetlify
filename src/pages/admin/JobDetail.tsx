import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { IoArrowBack, IoWarning } from 'react-icons/io5'
import toast from 'react-hot-toast'

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  bidAccepted: 'bg-blue-100 text-blue-700',
  inspectionDone: 'bg-purple-100 text-purple-700',
  workCostProposed: 'bg-yellow-100 text-yellow-700',
  workCostAccepted: 'bg-green-100 text-green-700',
  inProgress: 'bg-teal-100 text-teal-700',
  paused: 'bg-orange-100 text-orange-700',
  disputed: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function AdminJobDetail() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [job, setJob] = useState<any>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [dispute, setDispute] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [adminNote, setAdminNote] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [jobId])

  async function fetchAll() {
    const [{ data: j }, { data: e }, { data: d }, { data: m }] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', jobId).single(),
      supabase.from('escrow').select('*').eq('job_id', jobId).maybeSingle(),
      supabase.from('disputes').select('*').eq('job_id', jobId).eq('status', 'open').maybeSingle(),
      supabase.from('messages').select('*').eq('job_id', jobId).order('created_at').limit(50),
    ])
    if (j) { setJob(j); setAdminNote(j.admin_note || '') }
    if (e) setEscrow(e)
    if (d) setDispute(d)
    if (m) setMessages(m)
  }

  async function saveNote() {
    await supabase.from('jobs').update({ admin_note: adminNote }).eq('id', jobId)
    toast.success('Note saved')
  }

  async function cancelJob() {
    if (!cancelReason.trim()) return
    await supabase.from('jobs').update({
      status: 'cancelled',
      cancellation_reason: cancelReason,
      cancellation_actor: 'admin',
      cancelled_by: user?.id,
    }).eq('id', jobId)
    if (escrow && escrow.total_locked > 0) {
      await supabase.rpc('fn_dispute_settle', {
        p_job_id: jobId,
        p_settled_amount: 0,
        p_resolution: 'cancel',
        p_admin_id: user?.id,
        p_notes: cancelReason,
      })
    }
    await supabase.from('admin_actions').insert({
      admin_id: user?.id, action_type: 'job_cancelled',
      entity_type: 'job', entity_id: jobId, notes: cancelReason,
    })
    toast.success('Job cancelled')
    setShowCancel(false)
    fetchAll()
  }

  if (!job) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>

  const totalAmount = job.work_cost_total || job.inspection_charges || 0

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/admin/jobs')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <IoArrowBack /> Back to Jobs
      </button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
            <p className="text-gray-500 mt-1">{job.category} · {job.city}</p>
          </div>
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLOR[job.status] || 'bg-gray-100 text-gray-600'}`}>
            {job.status}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Customer</p>
            <p className="font-medium text-gray-900">{job.customer_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Worker</p>
            <p className="font-medium text-gray-900">{job.worker_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Location</p>
            <p className="text-gray-700">{job.location}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Posted</p>
            <p className="text-gray-700">{new Date(job.created_at).toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Description</p>
          <p className="text-sm text-gray-700">{job.description}</p>
        </div>

        {job.cancellation_reason && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700"><strong>Cancellation reason:</strong> {job.cancellation_reason}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Financials</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Inspection Fee</span>
              <span className="font-medium">₨{(job.inspection_charges || 0).toLocaleString()}</span>
            </div>
            {job.work_cost > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Work Cost</span>
                <span className="font-medium">₨{(job.work_cost || 0).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-gray-900">₨{totalAmount.toLocaleString()}</span>
            </div>
            {job.platform_fee && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Platform (10%)</span>
                <span>₨{job.platform_fee.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {escrow && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Escrow</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status</span>
                <span className="font-medium capitalize">{escrow.status.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Inspection Held</span>
                <span className="font-medium">₨{escrow.inspection_amount.toLocaleString()}</span>
              </div>
              {escrow.work_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Work Amount Held</span>
                  <span className="font-medium">₨{escrow.work_amount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
                <span className="font-semibold text-gray-900">Total Locked</span>
                <span className="font-bold text-purple-700">₨{escrow.total_locked.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {dispute && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <IoWarning className="text-red-600 text-lg" />
            <h2 className="font-semibold text-red-900">Open Dispute</h2>
          </div>
          <p className="text-sm text-red-800 mb-4">{dispute.reason}</p>
          <button onClick={() => navigate(`/admin/disputes/${dispute.id}`)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
            Resolve Dispute
          </button>
        </div>
      )}

      {messages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Chat History ({messages.length} messages)</h2>
          </div>
          <div className="p-5 space-y-3 max-h-80 overflow-y-auto">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.is_customer ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${msg.is_customer ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>
                  <p className={`text-xs mb-1 ${msg.is_customer ? 'text-white/70' : 'text-gray-400'}`}>
                    {msg.is_customer ? 'Customer' : 'Worker'}
                  </p>
                  {msg.text && <p>{msg.text}</p>}
                  {msg.image_url && <img src={msg.image_url} alt="" className="w-32 h-24 object-cover rounded-lg mt-1" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Admin Note</h2>
        <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)}
          rows={3} placeholder="Internal notes about this job..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
        <button onClick={saveNote} className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark">
          Save Note
        </button>
      </div>

      {!['completed', 'cancelled'].includes(job.status) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Admin Actions</h2>
          {!showCancel
            ? <button onClick={() => setShowCancel(true)} className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100">
                Cancel Job
              </button>
            : <div className="flex gap-2">
                <input value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                <button onClick={cancelJob} disabled={!cancelReason.trim()} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  Confirm
                </button>
                <button onClick={() => setShowCancel(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">
                  Cancel
                </button>
              </div>
          }
        </div>
      )}
    </div>
  )
}
