import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoArrowBack, IoCheckmarkCircle, IoChatbubble, IoLocation, IoCall, IoStar, IoCloseCircle, IoGift, IoWallet } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import WorkerTrackingMap from '../../components/WorkerTrackingMap'
import type { Job } from '../../types'
import toast from 'react-hot-toast'

const STATES = ['bidAccepted', 'inspectionDone', 'workCostProposed', 'workCostAccepted', 'completed'] as const
const STATE_LABELS = ['Bid Accepted', 'Inspection Done', 'Cost Proposed', 'Cost Approved', 'Completed']

export default function CustomerActiveJob() {
  const nav = useNavigate()
  const { jobId } = useParams()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)

  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0)
  const [rewardPoints, setRewardPoints] = useState(0)

  // Inspection confirmation modal
  const [showInspectionConfirm, setShowInspectionConfirm] = useState(false)
  const [useRewardInspection, setUseRewardInspection] = useState(false)
  const [settlingInspection, setSettlingInspection] = useState(false)

  // Work cost acceptance reward
  const [useRewardWorkAccept, setUseRewardWorkAccept] = useState(false)

  // Job complete confirmation modal
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [useRewardComplete, setUseRewardComplete] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Cancel
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const fetchWallet = async () => {
    if (!user) return
    const { data } = await supabase.from('wallets').select('balance, reward_points').eq('user_id', user.id).single()
    if (data) { setWalletBalance(data.balance || 0); setRewardPoints(data.reward_points || 0) }
  }

  useEffect(() => {
    if (!jobId || !user) return
    supabase.from('jobs').select('*').eq('id', jobId).single().then(({ data }) => {
      if (data) setJob(data as Job)
      setLoading(false)
    })
    fetchWallet()
    const channel = supabase.channel(`job-customer-${jobId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          const newJob = payload.new as Job
          setJob(newJob)
          if (newJob.status === 'workCostProposed') toast('💰 Worker proposed work cost — please review!', { duration: 5000 })
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [jobId, user])

  const stateIndex = job ? (STATES as readonly string[]).indexOf(job.status) : -1
  const inspectionFee = job?.inspection_charges || 0
  const workCost = job?.work_cost || 0
  const total = inspectionFee + workCost

  // ── Inspection complete → show confirmation modal (no deduction yet) ──
  const markInspectionComplete = () => {
    setShowInspectionConfirm(true)
  }

  // ── Confirm inspection — just marks status, no money moved here ──
  const confirmInspectionComplete = async () => {
    setSettlingInspection(true)
    const { error } = await supabase.from('jobs').update({ status: 'inspectionDone' }).eq('id', jobId)
    if (error) { setSettlingInspection(false); return toast.error(error.message) }
    setShowInspectionConfirm(false)
    setSettlingInspection(false)
    toast.success('Inspection marked complete!')
  }

  const requestWorkCost = async () => {
    const { error } = await supabase.from('jobs').update({ status: 'proceedRequested' }).eq('id', jobId)
    if (error) return toast.error(error.message)
    await supabase.from('notifications').insert({
      user_id: job!.worker_id, type: 'system',
      title: 'Customer wants to proceed',
      body: 'Customer approved inspection and wants to proceed. Please submit your work cost.',
    })
    toast.success('Worker notified! Waiting for work cost proposal.')
  }

  // ── End at inspection — money IS deducted here from escrow ──
  const endAtInspection = async () => {
    const { error } = await supabase.rpc('fn_settle_inspection_only', { p_job_id: jobId, p_reward_discount: 0 })
    if (error) return toast.error(error.message)
    await supabase.from('jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', jobId)
    toast('Job ended at inspection. Payment settled.')
    nav(`/customer/receipt/${jobId}`)
  }

  // ── Accept work cost — locks work amount in escrow ──
  const acceptWorkCost = async () => {
    if (!job?.worker_id || !job.work_cost) return
    const discount = useRewardWorkAccept ? Math.min(rewardPoints, job.work_cost) : 0
    const { error } = await supabase.rpc('fn_lock_work_escrow', {
      p_job_id: jobId,
      p_customer_id: job.customer_id,
      p_worker_id: job.worker_id,
      p_work_amount: job.work_cost,
      p_reward_discount: discount,
    })
    if (error) {
      if (error.message.includes('insufficient_balance')) return toast.error('Insufficient wallet balance. Please top up.')
      if (error.message.includes('worker_insufficient_balance')) return toast.error('Worker has insufficient balance (needs ₨20)')
      if (error.message.includes('insufficient_reward_points')) return toast.error('Not enough reward points')
      return toast.error(error.message)
    }
    await supabase.from('jobs').update({ status: 'inProgress' }).eq('id', jobId)
    toast.success(discount > 0 ? `Work started! ₨${discount} reward discount applied.` : 'Work cost accepted! Job is now in progress.')
    await fetchWallet()
  }

  const declineWorkCost = async () => {
    const { error } = await supabase.rpc('fn_settle_inspection_only', { p_job_id: jobId, p_reward_discount: 0 })
    if (error) return toast.error(error.message)
    await supabase.from('jobs').update({ status: 'completed', completed_at: new Date().toISOString(), work_cost: 0 }).eq('id', jobId)
    toast('Work cost declined — inspection fee settled.')
    nav(`/customer/receipt/${jobId}`)
  }

  // ── Mark complete — opens confirmation modal ──
  const markComplete = () => {
    setUseRewardComplete(false)
    setShowCompleteConfirm(true)
  }

  // ── Confirm completion — deducts from escrow, applies reward ──
  const confirmComplete = async (rateAfter: boolean) => {
    if (confirming) return
    setConfirming(true)
    const discount = useRewardComplete ? Math.min(rewardPoints, total) : 0
    const { error } = await supabase.rpc('fn_complete_job', { p_job_id: jobId, p_reward_discount: discount })
    if (error) { setConfirming(false); return toast.error(error.message) }
    setShowCompleteConfirm(false)
    toast.success(discount > 0 ? `Job completed! ₨${discount} reward discount applied.` : 'Job completed!')
    if (rateAfter) nav(`/customer/review/${jobId}`)
    else nav('/customer/home')
  }

  const cancelJob = async () => {
    if (!job) return
    setCancelling(true)
    const { error } = await supabase.rpc('fn_cancel_job', { p_job_id: job.id, p_customer_id: job.customer_id })
    setCancelling(false)
    setShowCancelConfirm(false)
    if (error) return toast.error('Failed to cancel: ' + error.message)
    toast.success('Job cancelled. Any locked funds refunded.')
    nav('/customer/home', { replace: true })
  }

  const canCancel = job && ['bidAccepted', 'inspectionDone', 'proceedRequested', 'workCostProposed', 'workCostRejected'].includes(job.status)

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] text-sm text-text-muted">Loading...</div>
  if (!job) return <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] text-sm text-text-muted">Job not found</div>

  // Helpers for reward discount display
  const workDiscount = Math.min(rewardPoints, workCost > 0 ? workCost : 0)
  const completeDiscount = Math.min(rewardPoints, total)

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Header */}
      <div className="bg-primary px-6 pt-10 pb-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => nav(-1)}><IoArrowBack size={24} className="text-white" /></button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-medium">Job Tracking</h1>
          </div>
          <div className="flex items-center gap-2">
            {canCancel && (
              <button onClick={() => setShowCancelConfirm(true)}
                className="flex items-center gap-1 bg-red-500/80 text-white text-xs font-medium px-3 py-1.5 rounded-xl hover:bg-red-500 transition">
                <IoCloseCircle size={14} /> Cancel
              </button>
            )}
            <button onClick={() => nav(`/chat/${jobId}`)}
              className="flex items-center gap-1.5 bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-xl">
              <IoChatbubble size={14} /> Chat
            </button>
          </div>
        </div>
        <div className="bg-white/10 rounded-2xl p-4">
          <p className="text-white font-medium text-base">{job.title}</p>
          <p className="text-white/70 flex items-center gap-1.5 text-sm mt-1">
            <IoLocation size={14} /> {job.location}
          </p>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        {/* Progress tracker */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-text-primary mb-5">Job Progress</p>
          <div className="flex items-start gap-1">
            {STATES.map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${i <= stateIndex ? 'bg-primary text-white' : 'bg-border text-text-muted'}`}>
                  {i <= stateIndex ? <IoCheckmarkCircle size={18} /> : i + 1}
                </div>
                <p className={`text-[9px] mt-1 text-center leading-tight ${i <= stateIndex ? 'text-primary font-medium' : 'text-text-muted'}`}>{STATE_LABELS[i]}</p>
              </div>
            ))}
          </div>
          <div className="flex mx-3.5 -mt-[38px] mb-6">
            {STATES.slice(0, -1).map((_, i) => (
              <div key={i} className={`flex-1 h-0.5 mt-3.5 ${i < stateIndex ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        </div>

        {/* Worker info */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
            {job.worker_photo
              ? <img src={job.worker_photo} className="w-full h-full object-cover" alt="worker" />
              : <span className="text-2xl font-bold text-primary">{job.worker_name?.[0] || 'W'}</span>}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">{job.worker_name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <IoStar size={13} className="text-yellow-400" />
              <span className="text-xs text-text-muted">Assigned Worker</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <IoCall size={16} className="text-white" />
            </button>
            <button onClick={() => nav(`/chat/${jobId}`)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <IoChatbubble size={16} className="text-text-muted" />
            </button>
          </div>
        </div>

        {/* Live location map */}
        {job.worker_id && !['completed', 'cancelled'].includes(job.status) && (
          <WorkerTrackingMap workerId={job.worker_id} jobId={job.id} workerName={job.worker_name || 'Worker'} />
        )}

        {/* Payment details */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-text-primary mb-4">Payment Details</p>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Inspection Fee</span>
              <span className="font-medium">₨{inspectionFee}</span>
            </div>
            {workCost > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Work Cost</span>
                <span className="font-medium">₨{workCost}</span>
              </div>
            )}

            {/* Work cost proposal */}
            {job.status === 'workCostProposed' && (
              <div className="mt-1 p-4 bg-yellow-50 border border-yellow-200 rounded-xl space-y-3">
                <div>
                  <p className="text-sm text-text-primary font-semibold">Worker proposes: <span className="text-primary">₨{job.work_cost}</span></p>
                  <p className="text-xs text-text-muted mt-0.5">Accept to start work or decline to end at inspection.</p>
                </div>

                {/* Reward toggle for work cost */}
                {rewardPoints > 0 && (
                  <button onClick={() => setUseRewardWorkAccept(v => !v)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-medium transition ${useRewardWorkAccept ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-border text-text-secondary'}`}>
                    <span className="flex items-center gap-1.5"><IoGift size={14} /> Use {workDiscount} reward pts — save ₨{workDiscount}</span>
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${useRewardWorkAccept ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                      {useRewardWorkAccept && <span className="text-white text-[9px]">✓</span>}
                    </span>
                  </button>
                )}
                {useRewardWorkAccept && rewardPoints > 0 && (
                  <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5 text-center">
                    You pay ₨{(job.work_cost || 0) - workDiscount} · KarigarGo covers ₨{workDiscount}
                  </p>
                )}

                <div className="flex gap-2">
                  <button onClick={acceptWorkCost} className="flex-1 py-2.5 bg-primary text-white text-sm font-medium rounded-xl">✅ Accept & Start</button>
                  <button onClick={declineWorkCost} className="flex-1 py-2.5 border border-border text-sm text-text-secondary rounded-xl">❌ Decline</button>
                </div>
              </div>
            )}

            {job.status === 'proceedRequested' && <p className="text-xs text-warning">⏳ Waiting for worker to submit work cost...</p>}
            {job.status === 'bidAccepted' && <p className="text-xs text-warning">⏳ Worker is on the way to inspect...</p>}
          </div>
        </div>

        {/* ACTION BUTTONS */}

        {/* Step 1: Mark inspection complete → opens confirmation modal */}
        {job.status === 'bidAccepted' && (
          <button onClick={markInspectionComplete} className="btn-primary">✅ Mark Inspection Complete</button>
        )}

        {/* Step 2: Inspection done — proceed or end */}
        {job.status === 'inspectionDone' && (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <p className="text-sm font-semibold text-green-800 mb-1">Inspection Complete ✅</p>
              <p className="text-xs text-green-700">What would you like to do next?</p>
            </div>
            <button onClick={requestWorkCost} className="btn-primary">🔧 Proceed with Work — Request Cost</button>
            <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
              <p className="text-sm font-medium text-text-primary">End job here — pay inspection fee only</p>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-text-secondary">You Pay</span>
                <span className="text-primary">₨{inspectionFee}</span>
              </div>
              <p className="text-xs text-text-muted">To apply reward discount, use it when accepting a bid next time.</p>
              <button onClick={endAtInspection} className="w-full py-3 border border-border bg-white text-text-secondary text-sm font-medium rounded-xl">
                🚪 End Job Here
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Waiting */}
        {job.status === 'proceedRequested' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-semibold text-yellow-800">Waiting for Worker</p>
            <p className="text-xs text-yellow-700 mt-1">Worker will submit their work cost shortly.</p>
          </div>
        )}

        {/* Step 4: Mark complete → opens confirmation modal */}
        {job.status === 'inProgress' && (
          <button onClick={markComplete} className="btn-primary">✅ Mark Job Complete</button>
        )}

        {/* Completed */}
        {job.status === 'completed' && (
          <button onClick={() => nav(`/customer/receipt/${job.id}`)} className="btn-primary">View Receipt</button>
        )}
      </div>

      {/* ── INSPECTION CONFIRMATION MODAL ── */}
      {showInspectionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <IoCheckmarkCircle size={26} className="text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary text-center mb-1">Confirm Inspection Complete</h3>
            <p className="text-xs text-text-muted text-center mb-5">Inspection fee is locked in escrow. Proceed or end the job after this.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowInspectionConfirm(false)} className="flex-1 py-3 border border-border rounded-xl text-sm font-medium">Go Back</button>
              <button onClick={confirmInspectionComplete} disabled={settlingInspection}
                className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {settlingInspection ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── JOB COMPLETE CONFIRMATION MODAL ── */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={(e) => { if (e.target === e.currentTarget) setShowCompleteConfirm(false) }}>
          <div className="bg-white w-full max-w-[430px] rounded-t-3xl p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-text-primary mb-1">Confirm Job Complete</h3>
            <p className="text-sm text-text-secondary mb-4">Review before confirming. Payment will be processed.</p>

            {/* Wallet balance */}
            <div className="flex items-center gap-2 bg-surface rounded-xl px-4 py-2.5 mb-4">
              <IoWallet size={16} className="text-primary" />
              <span className="text-xs text-text-secondary">Wallet Balance</span>
              <span className="ml-auto text-sm font-semibold text-primary">₨{walletBalance.toLocaleString()}</span>
            </div>

            {/* Breakdown */}
            <div className="bg-surface rounded-xl p-4 mb-4 space-y-2.5">
              {inspectionFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Inspection Fee</span>
                  <span className="font-medium">₨{inspectionFee}</span>
                </div>
              )}
              {workCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Work Cost</span>
                  <span className="font-medium">₨{workCost}</span>
                </div>
              )}
              {useRewardComplete && rewardPoints > 0 && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Reward Discount</span>
                  <span className="font-medium">− ₨{completeDiscount}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
                <span>You Pay</span>
                <span className="text-primary text-base">₨{useRewardComplete ? total - completeDiscount : total}</span>
              </div>
              {useRewardComplete && rewardPoints > 0 && (
                <p className="text-[11px] text-green-700 text-center">KarigarGo covers ₨{completeDiscount}</p>
              )}
            </div>

            {/* Reward toggle */}
            {rewardPoints > 0 && (
              <button onClick={() => setUseRewardComplete(v => !v)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition mb-4 ${useRewardComplete ? 'bg-green-50 border-green-300 text-green-700' : 'bg-surface border-border text-text-secondary'}`}>
                <span className="flex items-center gap-2"><IoGift size={16} /> Use {completeDiscount} reward points — save ₨{completeDiscount}</span>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${useRewardComplete ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                  {useRewardComplete && <span className="text-white text-[10px]">✓</span>}
                </span>
              </button>
            )}

            <div className="space-y-2">
              <button onClick={() => confirmComplete(true)} disabled={confirming}
                className="w-full py-3.5 bg-primary text-white rounded-2xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                <IoStar size={16} />
                {confirming ? 'Processing...' : 'Confirm & Rate Worker'}
              </button>
              <button onClick={() => confirmComplete(false)} disabled={confirming}
                className="w-full py-3.5 border border-border bg-white text-text-secondary rounded-2xl text-sm font-medium disabled:opacity-60">
                Confirm & Review Later
              </button>
              <button onClick={() => setShowCompleteConfirm(false)} className="w-full py-2 text-xs text-text-muted">Go Back</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CANCEL CONFIRMATION ── */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <IoCloseCircle size={26} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary text-center mb-2">Cancel Job?</h3>
            <p className="text-sm text-text-secondary text-center mb-6">The job will be cancelled and the worker notified. Any locked funds will be refunded.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-3 border border-border rounded-xl text-sm font-medium">Keep Job</button>
              <button onClick={cancelJob} disabled={cancelling}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
