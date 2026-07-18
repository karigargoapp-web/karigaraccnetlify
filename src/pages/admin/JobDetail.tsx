import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { IoArrowBack, IoWarning, IoChatbubble, IoWallet } from 'react-icons/io5'
import toast from 'react-hot-toast'
import { JOB_STATUS_LABELS } from '../../types'

const STATUS_COLOR: Record<string,string> = {
  pending:'bg-gray-100 text-gray-600', bidAccepted:'bg-blue-100 text-blue-700',
  inspectionDone:'bg-purple-100 text-purple-700', workCostProposed:'bg-yellow-100 text-yellow-700',
  workCostAccepted:'bg-emerald-100 text-emerald-700', inProgress:'bg-teal-100 text-teal-700',
  paused:'bg-orange-100 text-orange-700', disputed:'bg-red-100 text-red-700',
  completed:'bg-green-100 text-green-800', cancelled:'bg-gray-100 text-gray-500',
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
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [jobId])

  async function fetchAll() {
    setLoading(true)
    const [{ data:j },{ data:e },{ data:d },{ data:m }] = await Promise.all([
      supabase.from('jobs').select('*').eq('id',jobId).single(),
      supabase.from('escrow').select('*').eq('job_id',jobId).maybeSingle(),
      supabase.from('disputes').select('*').eq('job_id',jobId).eq('status','open').maybeSingle(),
      supabase.from('messages').select('*').eq('job_id',jobId).order('created_at').limit(50),
    ])
    if (j) { setJob(j); setAdminNote(j.admin_note||'') }
    if (e) setEscrow(e)
    if (d) setDispute(d)
    if (m) setMessages(m)
    setLoading(false)
  }

  async function saveNote() {
    setSaving(true)
    await supabase.from('jobs').update({ admin_note:adminNote }).eq('id',jobId)
    toast.success('Note saved')
    setSaving(false)
  }

  async function cancelJob() {
    if (!cancelReason.trim()) return
    await supabase.from('jobs').update({ status:'cancelled', cancellation_reason:cancelReason, cancellation_actor:'admin', cancelled_by:user?.id }).eq('id',jobId)
    if (escrow && escrow.total_locked > 0) {
      await supabase.rpc('fn_dispute_settle', { p_job_id:jobId, p_settled_amount:0, p_resolution:'cancel', p_admin_id:user?.id, p_notes:cancelReason })
    }
    await supabase.from('admin_actions').insert({ admin_id:user?.id, action_type:'job_cancelled', entity_type:'job', entity_id:jobId, notes:cancelReason })
    await supabase.from('notifications').insert([
      { user_id:job.customer_id, type:'system', title:'Job Cancelled by Admin', body:cancelReason },
      ...(job.worker_id ? [{ user_id:job.worker_id, type:'system', title:'Job Cancelled by Admin', body:cancelReason }] : []),
    ])
    toast.success('Job cancelled')
    setShowCancel(false)
    fetchAll()
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"/></div>
  if (!job) return <div className="text-center py-16 text-gray-400">Job not found</div>

  const totalAmount = job.work_cost_total || job.inspection_charges || 0

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/admin/jobs')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm">
        <IoArrowBack size={16}/> Back to Jobs
      </button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[job.status]||'bg-gray-100 text-gray-600'}`}>{JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS] || job.status}</span>
              {job.category && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{job.category}</span>}
              {job.city && <span className="text-xs text-gray-500">📍 {job.city}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-bold text-gray-900">₨{totalAmount.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-500 font-medium mb-1">Customer</p>
            <p className="font-semibold text-gray-900 text-sm">{job.customer_name}</p>
          </div>
          <div className="bg-teal-50 rounded-xl p-3">
            <p className="text-xs text-teal-500 font-medium mb-1">Worker</p>
            <p className="font-semibold text-gray-900 text-sm">{job.worker_name||'Not assigned'}</p>
          </div>
        </div>

        {job.description && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 mb-1">Description</p>
            <p className="text-sm text-gray-700">{job.description}</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {job.date && <div><p className="text-xs text-gray-400">Date</p><p className="text-gray-700">{job.date}</p></div>}
          {job.created_at && <div><p className="text-xs text-gray-400">Posted</p><p className="text-gray-700">{new Date(job.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p></div>}
          {job.completed_at && <div><p className="text-xs text-gray-400">Completed</p><p className="text-gray-700">{new Date(job.completed_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p></div>}
          {job.paused_at && <div><p className="text-xs text-gray-400">Paused At</p><p className="text-orange-600">{new Date(job.paused_at).toLocaleString()}</p></div>}
        </div>

        {job.cancellation_reason && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-xs font-medium text-red-600">Cancellation reason ({job.cancellation_actor}):</p>
            <p className="text-sm text-red-700 mt-0.5">{job.cancellation_reason}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <IoWallet className="text-gray-400"/>
            <h2 className="font-semibold text-gray-900">Financials</h2>
          </div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Inspection Fee</span><span className="font-medium">₨{(job.inspection_charges||0).toLocaleString()}</span></div>
            {job.work_cost > 0 && <div className="flex justify-between"><span className="text-gray-500">Work Cost</span><span className="font-medium">₨{(job.work_cost||0).toLocaleString()}</span></div>}
            <div className="flex justify-between border-t border-gray-100 pt-2.5 font-semibold">
              <span>Total</span><span>₨{totalAmount.toLocaleString()}</span>
            </div>
            {job.platform_fee > 0 && <div className="flex justify-between text-gray-400 text-xs"><span>Platform (10%)</span><span>₨{job.platform_fee.toLocaleString()}</span></div>}
          </div>
        </div>

        {escrow && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Escrow Status</h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Status</span>
                <span className="font-medium capitalize">{escrow.status.replace(/_/g,' ')}</span>
              </div>
              <div className="flex justify-between"><span className="text-gray-500">Inspection Held</span><span>₨{escrow.inspection_amount.toLocaleString()}</span></div>
              {escrow.work_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">Work Amount Held</span><span>₨{escrow.work_amount.toLocaleString()}</span></div>}
              <div className="flex justify-between border-t border-gray-100 pt-2.5 font-bold">
                <span>Total Locked</span><span className="text-purple-700">₨{escrow.total_locked.toLocaleString()}</span>
              </div>
              {escrow.released_at && <div className="text-xs text-gray-400">Released {new Date(escrow.released_at).toLocaleDateString()}</div>}
            </div>
          </div>
        )}
      </div>

      {dispute && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <IoWarning className="text-red-600 text-lg"/>
            <h2 className="font-semibold text-red-900">Open Dispute</h2>
          </div>
          <p className="text-sm text-red-800 mb-4">{dispute.reason}</p>
          <button onClick={() => navigate(`/admin/disputes/${dispute.id}`)}
            className="w-full py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700">
            Resolve This Dispute →
          </button>
        </div>
      )}

      {messages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <IoChatbubble className="text-gray-400"/>
            <h2 className="font-semibold text-gray-900">Chat History</h2>
            <span className="ml-auto text-xs text-gray-400">{messages.length} messages</span>
          </div>
          <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.is_customer ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${msg.is_customer ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>
                  <p className={`text-xs mb-1 ${msg.is_customer ? 'text-white/60' : 'text-gray-400'}`}>{msg.is_customer ? 'Customer' : 'Worker'}</p>
                  {msg.text && <p>{msg.text}</p>}
                  {msg.image_url && <img src={msg.image_url} alt="" className="w-28 h-20 object-cover rounded-lg mt-1"/>}
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
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"/>
        <button onClick={saveNote} disabled={saving}
          className="mt-2.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Note'}
        </button>
      </div>

      {!['completed','cancelled'].includes(job.status) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Admin Actions</h2>
          {!showCancel
            ? <button onClick={() => setShowCancel(true)} className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100">
                Cancel This Job
              </button>
            : <div className="space-y-2">
                <input value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"/>
                <div className="flex gap-2">
                  <button onClick={cancelJob} disabled={!cancelReason.trim()} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-red-700">Confirm Cancel</button>
                  <button onClick={() => setShowCancel(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Dismiss</button>
                </div>
              </div>
          }
        </div>
      )}
    </div>
  )
}
