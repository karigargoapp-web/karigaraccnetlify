import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { IoArrowBack, IoChatbubble } from 'react-icons/io5'
import toast from 'react-hot-toast'
import type { DisputeResolution, DisputeMessage } from '../../types'
import DisputeMediaView from '../../components/DisputeMediaView'
import DisputeMessageList from '../../components/DisputeMessageList'
import DisputeMediaPicker, { DisputeMedia } from '../../components/DisputeMediaPicker'

export default function AdminDisputeDetail() {
  const { disputeId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [dispute, setDispute] = useState<any>(null)
  const [job, setJob] = useState<any>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [disputeMessages, setDisputeMessages] = useState<DisputeMessage[]>([])
  const [remarkText, setRemarkText] = useState('')
  const [remarkParty, setRemarkParty] = useState<'customer' | 'worker'>('customer')
  const [remarkMedia, setRemarkMedia] = useState<DisputeMedia>({})
  const [sendingRemark, setSendingRemark] = useState(false)
  const [resolution, setResolution] = useState<DisputeResolution>('continue')
  const [settledPct, setSettledPct] = useState(50)
  const [adminNotes, setAdminNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchDisputeMessages = useCallback(async () => {
    if (!disputeId) return
    const { data } = await supabase.from('dispute_messages').select('*').eq('dispute_id', disputeId).order('created_at', { ascending: true })
    if (data) setDisputeMessages(data as DisputeMessage[])
  }, [disputeId])

  useEffect(() => { fetchAll(); fetchDisputeMessages() }, [disputeId])

  useEffect(() => {
    if (!disputeId) return
    const channel = supabase.channel(`admin-dispute-messages-${disputeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dispute_messages', filter: `dispute_id=eq.${disputeId}` },
        (payload) => setDisputeMessages(prev => [...prev, payload.new as DisputeMessage]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [disputeId])

  async function fetchAll() {
    setLoading(true)
    const { data:d } = await supabase.from('disputes').select('*').eq('id',disputeId).single()
    if (!d) { setLoading(false); return }
    setDispute(d)
    const [{ data:j },{ data:e },{ data:m }] = await Promise.all([
      supabase.from('jobs').select('*').eq('id',d.job_id).single(),
      supabase.from('escrow').select('*').eq('job_id',d.job_id).maybeSingle(),
      supabase.from('messages').select('*').eq('job_id',d.job_id).order('created_at').limit(30),
    ])
    if (j) setJob(j)
    if (e) setEscrow(e)
    if (m) setMessages(m)
    setLoading(false)
  }

  async function sendRemark() {
    if (!remarkText.trim()) { toast.error('Please enter a remark'); return }
    if (!user || !job) return
    const targetId = remarkParty === 'customer' ? job.customer_id : job.worker_id
    if (!targetId) { toast.error(`No ${remarkParty} assigned to this job`); return }
    setSendingRemark(true)
    try {
      const { error } = await supabase.from('dispute_messages').insert({
        dispute_id: disputeId,
        sender_id: user.id,
        sender_role: 'admin',
        message: remarkText.trim(),
        directed_to: targetId,
        photo_url: remarkMedia.photo_url,
        voice_url: remarkMedia.voice_url,
        video_url: remarkMedia.video_url,
      })
      if (error) throw error
      await supabase.from('notifications').insert({
        user_id: targetId, type: 'system',
        title: 'Admin Requested More Information',
        body: `Regarding "${job.title}": ${remarkText.trim()}`,
      })
      setRemarkText('')
      setRemarkMedia({})
      toast.success(`Remark sent to ${remarkParty}`)
    } catch {
      toast.error('Failed to send remark')
    } finally {
      setSendingRemark(false)
    }
  }

  async function resolveDispute() {
    if (!adminNotes.trim()) { toast.error('Please add resolution notes'); return }
    setSubmitting(true)
    const isCancellation = dispute.type === 'cancellation'
    try {
      if (resolution === 'continue') {
        const restoreStatus = dispute.status_before || 'inProgress'
        await supabase.from('jobs').update({ status: restoreStatus, paused_at:null }).eq('id',dispute.job_id)
        await supabase.from('disputes').update({ status:'resolved', resolution_type:'continue', admin_notes:adminNotes, resolved_by:user?.id, resolved_at:new Date().toISOString() }).eq('id',disputeId)
        await supabase.from('admin_actions').insert({ admin_id:user?.id, action_type:'dispute_resolved_continue', entity_type:'dispute', entity_id:disputeId, notes:adminNotes })
        const recipients = [job.customer_id, job.worker_id].filter(Boolean)
        if (recipients.length) {
          await supabase.from('notifications').insert(
            recipients.map(user_id => ({
              user_id, type:'system',
              title: isCancellation ? 'Cancellation Request Rejected — Job Continues' : 'Dispute Resolved - Job Continues',
              body: adminNotes,
            }))
          )
        }
        toast.success(isCancellation ? 'Request rejected — job resumed' : 'Job resumed successfully')
      } else {
        const total = escrow?.total_locked||0
        const settled = resolution==='partial' ? Math.round(total*settledPct/100) : 0
        const { error } = await supabase.rpc('fn_dispute_settle', { p_job_id:dispute.job_id, p_settled_amount:settled, p_resolution:resolution, p_admin_id:user?.id, p_notes:adminNotes })
        if (error) throw error
        await supabase.from('jobs').update({ status:'cancelled', admin_note:adminNotes }).eq('id',dispute.job_id)
        const recipients = [job.customer_id, job.worker_id].filter(Boolean)
        if (recipients.length) {
          await supabase.from('notifications').insert(
            recipients.map(user_id => ({
              user_id, type:'system',
              title: isCancellation ? 'Cancellation Approved' : 'Dispute Settled',
              body: adminNotes,
            }))
          )
        }
        toast.success(isCancellation ? 'Cancellation approved' : 'Dispute settled successfully')
      }
      navigate('/admin/disputes')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to resolve dispute. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"/></div>
  if (!dispute || !job) return <div className="text-center py-16 text-gray-400">Dispute not found</div>

  const total = escrow?.total_locked||0
  const workerGets = resolution==='partial' ? Math.round(total*settledPct/100) : resolution==='cancel' ? 0 : total
  const customerRefund = total - workerGets
  const commission = Math.round(workerGets*0.1)

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/admin/disputes')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm">
        <IoArrowBack size={16}/> Back to Disputes
      </button>

      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <h1 className="text-lg font-bold text-red-900 mb-1">
          {dispute.type === 'cancellation' ? 'Cancellation Request' : 'Dispute'}: {job.title}
        </h1>
        <div className="flex items-center gap-3 text-sm text-red-600 flex-wrap">
          <span>👤 {job.customer_name}</span>
          {job.worker_name && <><span>→</span><span>🔧 {job.worker_name}</span></>}
          {job.city && <span>📍 {job.city}</span>}
        </div>
        <div className="mt-3 p-3 bg-white/60 rounded-lg">
          <p className="text-xs font-medium text-red-600 mb-1">{dispute.type === 'cancellation' ? 'Cancellation Reason:' : 'Dispute Reason:'}</p>
          <p className="text-sm text-red-800">{dispute.reason}</p>
          <DisputeMediaView photo_url={dispute.photo_url} voice_url={dispute.voice_url} video_url={dispute.video_url} />
        </div>
        <p className="text-xs text-red-400 mt-2">Raised by {dispute.raised_by === job.worker_id ? 'worker' : 'customer'} · {new Date(dispute.created_at).toLocaleString()}</p>
      </div>

      {escrow && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Escrow Breakdown</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Inspection Fee</span><span>₨{escrow.inspection_amount.toLocaleString()}</span></div>
            {escrow.work_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">Work Amount</span><span>₨{escrow.work_amount.toLocaleString()}</span></div>}
            <div className="flex justify-between border-t border-gray-100 pt-2 font-bold">
              <span>Total Locked</span><span className="text-purple-700">₨{total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <IoChatbubble className="text-gray-400"/>
            <h2 className="font-semibold text-gray-900">Chat History</h2>
          </div>
          <div className="p-4 space-y-2.5 max-h-60 overflow-y-auto">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.is_customer ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${msg.is_customer ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>
                  <p className={`text-xs mb-1 ${msg.is_customer ? 'text-white/60' : 'text-gray-400'}`}>{msg.is_customer ? 'Customer' : 'Worker'}</p>
                  {msg.text && <p>{msg.text}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Dispute Remarks</h2>
        <p className="text-xs text-gray-400 -mt-2">
          Ask either party for more information. Only the selected party will see a box to respond — the other can only view.
        </p>
        <DisputeMessageList messages={disputeMessages} job={job} />

        {dispute.status === 'open' && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">Request info from</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setRemarkParty('customer')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border ${remarkParty === 'customer' ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600'}`}>
                  Customer {job.customer_name ? `(${job.customer_name})` : ''}
                </button>
                <button type="button" onClick={() => setRemarkParty('worker')}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border ${remarkParty === 'worker' ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-600'}`}>
                  Worker {job.worker_name ? `(${job.worker_name})` : ''}
                </button>
              </div>
            </div>
            <textarea value={remarkText} onChange={e => setRemarkText(e.target.value)} rows={3}
              placeholder="What additional information do you need?"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            <DisputeMediaPicker pathPrefix={`disputes/${dispute.job_id}`} media={remarkMedia} onChange={setRemarkMedia} />
            <button onClick={sendRemark} disabled={sendingRemark || !remarkText.trim()}
              className="w-full py-2.5 bg-gray-800 text-white rounded-xl text-sm font-medium disabled:opacity-40">
              {sendingRemark ? 'Sending...' : 'Send Remark'}
            </button>
          </div>
        )}
      </div>

      {dispute.status === 'open' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
          <h2 className="font-semibold text-gray-900">Choose Resolution</h2>

          <div className="space-y-3">
            {(dispute.type === 'cancellation' ? [
              { value:'continue', label:'Reject Request — Job Continues', desc:'Cancellation denied — job resumes from where it was', color:'border-green-200 bg-green-50' },
              { value:'partial', label:'Approve — Partial Refund', desc:'Pay worker for portion of work completed, refund the rest', color:'border-yellow-200 bg-yellow-50' },
              { value:'cancel', label:'Approve — Full Refund', desc:'Worker gets nothing, customer fully refunded, job cancelled', color:'border-red-200 bg-red-50' },
            ] as const : [
              { value:'continue', label:'Continue Job', desc:'Resolve misunderstanding — job resumes immediately', color:'border-green-200 bg-green-50' },
              { value:'partial', label:'Partial Settlement', desc:'Pay worker for portion of work completed', color:'border-yellow-200 bg-yellow-50' },
              { value:'cancel', label:'Cancel & Full Refund', desc:'Worker gets nothing, customer fully refunded', color:'border-red-200 bg-red-50' },
            ] as const).map(opt => (
              <label key={opt.value} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${resolution===opt.value ? `${opt.color} border-2` : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="resolution" value={opt.value} checked={resolution===opt.value} onChange={() => setResolution(opt.value)} className="mt-0.5"/>
                <div>
                  <p className="font-semibold text-gray-900">{opt.label}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {resolution==='partial' && total > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-gray-700">Work completed</span>
                <span className="font-bold text-primary">{settledPct}%</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={settledPct} onChange={e => setSettledPct(Number(e.target.value))} className="w-full accent-primary"/>
              <div className="mt-4 space-y-2 text-sm bg-white rounded-lg p-3 border border-yellow-100">
                <div className="flex justify-between"><span className="text-gray-500">Worker receives (after 10% commission)</span><span className="font-semibold text-green-700">₨{(workerGets-commission).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Platform commission</span><span className="font-medium">₨{commission.toLocaleString()}</span></div>
                <div className="flex justify-between border-t border-gray-100 pt-2"><span className="text-gray-500">Customer refunded</span><span className="font-semibold text-blue-700">₨{customerRefund.toLocaleString()}</span></div>
              </div>
            </div>
          )}

          {resolution==='cancel' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm">
              <p className="font-semibold text-blue-800">Customer refunded: ₨{total.toLocaleString()}</p>
              <p className="text-blue-600 mt-1 text-xs">Worker receives nothing. ₨20 bidding fee already deducted and is non-refundable.</p>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Final Remark <span className="text-red-500">*</span></label>
            <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
              rows={4} placeholder="Explain the final decision in detail. Both parties will receive this message..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"/>
          </div>

          <button onClick={resolveDispute} disabled={submitting||!adminNotes.trim()}
            className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-primary-dark transition-colors">
            {submitting ? 'Processing...' : 'Confirm Resolution'}
          </button>
        </div>
      )}

      {dispute.status === 'resolved' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <p className="font-semibold text-green-800">
            This {dispute.type === 'cancellation' ? 'cancellation request' : 'dispute'} has been resolved
          </p>
          <p className="text-sm text-green-700 mt-1 capitalize">Resolution: {dispute.resolution_type}</p>
          {dispute.settled_amount > 0 && <p className="text-sm text-green-700">Settled amount: ₨{dispute.settled_amount.toLocaleString()}</p>}
          {dispute.admin_notes && <p className="text-sm text-green-700 mt-1">{dispute.admin_notes}</p>}
        </div>
      )}
    </div>
  )
}
