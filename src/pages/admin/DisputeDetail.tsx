import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { IoArrowBack } from 'react-icons/io5'
import toast from 'react-hot-toast'
import type { DisputeResolution } from '../../types'

export default function AdminDisputeDetail() {
  const { disputeId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [dispute, setDispute] = useState<any>(null)
  const [job, setJob] = useState<any>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [resolution, setResolution] = useState<DisputeResolution>('continue')
  const [settledPct, setSettledPct] = useState(50)
  const [adminNotes, setAdminNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchAll() }, [disputeId])

  async function fetchAll() {
    const { data: d } = await supabase.from('disputes').select('*').eq('id', disputeId).single()
    if (!d) return
    setDispute(d)
    const [{ data: j }, { data: e }, { data: m }] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', d.job_id).single(),
      supabase.from('escrow').select('*').eq('job_id', d.job_id).maybeSingle(),
      supabase.from('messages').select('*').eq('job_id', d.job_id).order('created_at').limit(30),
    ])
    if (j) setJob(j)
    if (e) setEscrow(e)
    if (m) setMessages(m)
  }

  async function resolveDispute() {
    if (!adminNotes.trim()) { toast.error('Please add resolution notes'); return }
    setSubmitting(true)
    try {
      if (resolution === 'continue') {
        await supabase.from('jobs').update({ status: 'inProgress', paused_at: null }).eq('id', dispute.job_id)
        await supabase.from('disputes').update({
          status: 'resolved',
          resolution_type: 'continue',
          admin_notes: adminNotes,
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        }).eq('id', disputeId)
        await supabase.from('admin_actions').insert({
          admin_id: user?.id, action_type: 'dispute_resolved_continue',
          entity_type: 'dispute', entity_id: disputeId, notes: adminNotes,
        })
        const notifBase = { type: 'system', body: adminNotes }
        await supabase.from('notifications').insert([
          { ...notifBase, user_id: job.customer_id, title: 'Dispute Resolved - Job Continues' },
          { ...notifBase, user_id: job.worker_id, title: 'Dispute Resolved - Job Continues' },
        ])
        toast.success('Dispute resolved — job continues')
      } else {
        const total = escrow?.total_locked || 0
        const settled = resolution === 'partial' ? Math.round(total * settledPct / 100) : 0
        const { error } = await supabase.rpc('fn_dispute_settle', {
          p_job_id: dispute.job_id,
          p_settled_amount: settled,
          p_resolution: resolution,
          p_admin_id: user?.id,
          p_notes: adminNotes,
        })
        if (error) throw error
        await supabase.from('jobs').update({ status: 'cancelled', admin_note: adminNotes }).eq('id', dispute.job_id)
        const notifBase = { type: 'system', body: adminNotes }
        await supabase.from('notifications').insert([
          { ...notifBase, user_id: job.customer_id, title: 'Dispute Settled' },
          { ...notifBase, user_id: job.worker_id, title: 'Dispute Settled' },
        ])
        toast.success('Dispute settled')
      }
      navigate('/admin/disputes')
    } catch {
      toast.error('Failed to resolve dispute')
    } finally {
      setSubmitting(false)
    }
  }

  if (!dispute || !job) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>

  const total = escrow?.total_locked || 0
  const workerGets = resolution === 'partial' ? Math.round(total * settledPct / 100) : resolution === 'cancel' ? 0 : total
  const customerRefund = total - workerGets
  const commission = Math.round(workerGets * 0.1)

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/admin/disputes')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <IoArrowBack /> Back to Disputes
      </button>

      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <h1 className="text-lg font-bold text-red-900">Dispute: {job.title}</h1>
        <p className="text-sm text-red-700 mt-1">{job.customer_name} → {job.worker_name}</p>
        <p className="text-sm text-red-800 mt-3 font-medium">Reason:</p>
        <p className="text-sm text-red-700">{dispute.reason}</p>
        <p className="text-xs text-red-500 mt-2">Raised {new Date(dispute.created_at).toLocaleString()}</p>
      </div>

      {escrow && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Escrow Breakdown</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Inspection held</span><span>₨{escrow.inspection_amount.toLocaleString()}</span></div>
            {escrow.work_amount > 0 && <div className="flex justify-between"><span className="text-gray-600">Work amount held</span><span>₨{escrow.work_amount.toLocaleString()}</span></div>}
            <div className="flex justify-between border-t border-gray-100 pt-2 font-semibold"><span>Total locked</span><span>₨{total.toLocaleString()}</span></div>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-semibold text-gray-900">Chat History</h2></div>
          <div className="p-5 space-y-3 max-h-64 overflow-y-auto">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.is_customer ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${msg.is_customer ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>
                  <p className={`text-xs mb-1 ${msg.is_customer ? 'text-white/70' : 'text-gray-400'}`}>{msg.is_customer ? 'Customer' : 'Worker'}</p>
                  {msg.text && <p>{msg.text}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dispute.status === 'open' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
          <h2 className="font-semibold text-gray-900">Resolution</h2>

          <div className="space-y-3">
            {([
              { value: 'continue', label: 'Continue Job', desc: 'Resolve misunderstanding, job resumes' },
              { value: 'partial', label: 'Partial Settlement', desc: 'Pay worker for portion of work done' },
              { value: 'cancel', label: 'Cancel & Full Refund', desc: 'Worker gets nothing, customer refunded' },
            ] as const).map(opt => (
              <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${resolution === opt.value ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="resolution" value={opt.value} checked={resolution === opt.value} onChange={() => setResolution(opt.value)} className="mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">{opt.label}</p>
                  <p className="text-sm text-gray-500">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {resolution === 'partial' && total > 0 && (
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Work completed</span>
                <span className="font-semibold">{settledPct}%</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={settledPct} onChange={e => setSettledPct(Number(e.target.value))}
                className="w-full accent-primary" />
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Worker receives</span><span className="font-medium text-green-700">₨{(workerGets - commission).toLocaleString()} (after 10% commission)</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Customer refunded</span><span className="font-medium text-blue-700">₨{customerRefund.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Platform commission</span><span className="font-medium">₨{commission.toLocaleString()}</span></div>
              </div>
            </div>
          )}

          {resolution === 'cancel' && (
            <div className="p-4 bg-blue-50 rounded-xl text-sm">
              <p className="text-blue-800"><strong>Customer refunded:</strong> ₨{total.toLocaleString()}</p>
              <p className="text-blue-700 mt-1">Worker receives nothing. Bidding fee already deducted (not refunded).</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Resolution Notes (required)</label>
            <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
              rows={3} placeholder="Explain the resolution decision..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          </div>

          <button onClick={resolveDispute} disabled={submitting || !adminNotes.trim()}
            className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50 hover:bg-primary-dark transition-colors">
            {submitting ? 'Processing...' : 'Confirm Resolution'}
          </button>
        </div>
      )}
    </div>
  )
}
