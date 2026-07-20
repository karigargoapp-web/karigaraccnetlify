import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoArrowBack, IoCheckmarkCircle, IoChatbubble, IoLocation, IoCall, IoStar, IoCloseCircle, IoGift, IoWallet, IoWarning } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import WorkerTrackingMap from '../../components/WorkerTrackingMap'
import RaiseDisputeModal from '../../components/RaiseDisputeModal'
import DisputeBanner from '../../components/DisputeBanner'
import DisputeThread from '../../components/DisputeThread'
import type { Job, Dispute } from '../../types'
import toast from 'react-hot-toast'

const STATES = ['bidAccepted', 'inspectionDone', 'workCostProposed', 'workCostAccepted', 'completed'] as const
const STATE_LABELS = ['Bid Accepted', 'Inspection Done', 'Cost Proposed', 'Cost Approved', 'Completed']

export default function CustomerActiveJob() {
  const nav = useNavigate()
  const { jobId } = useParams()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)

  // Wallet & rewards
  const [walletBalance, setWalletBalance] = useState(0)
  const [rewardPoints, setRewardPoints] = useState(0)

  // Stored discounts (read from escrow after bid/work acceptance)
  const [storedInspectionDiscount, setStoredInspectionDiscount] = useState(0)
  const [storedWorkDiscount, setStoredWorkDiscount] = useState(0)

  // Work cost acceptance reward toggle
  const [useRewardWorkAccept, setUseRewardWorkAccept] = useState(false)

  // End-at-inspection reward toggle
  const [useRewardEndInspection, setUseRewardEndInspection] = useState(false)

  // Inspection complete modal
  const [showInspectionConfirm, setShowInspectionConfirm] = useState(false)
  const [settlingInspection, setSettlingInspection] = useState(false)

  // Job complete modal
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Dispute / Cancellation
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [dispute, setDispute] = useState<Dispute | null>(null)

  const fetchWalletAndEscrow = async () => {
    if (!user || !jobId) return
    const [walletRes, escrowRes] = await Promise.all([
      supabase.from('wallets').select('balance, reward_points').eq('user_id', user.id).single(),
      supabase.from('escrow').select('inspection_reward_discount, work_reward_discount').eq('job_id', jobId).maybeSingle(),
    ])
    if (walletRes.data) {
      setWalletBalance(walletRes.data.balance || 0)
      setRewardPoints(walletRes.data.reward_points || 0)
    }
    if (escrowRes.data) {
      setStoredInspectionDiscount(escrowRes.data.inspection_reward_discount || 0)
      setStoredWorkDiscount(escrowRes.data.work_reward_discount || 0)
    }
  }

  const fetchDispute = async () => {
    if (!jobId) return
    const { data } = await supabase.from('disputes').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setDispute(data as Dispute | null)
  }

  useEffect(() => {
    if (!jobId || !user) return
    supabase.from('jobs').select('*').eq('id', jobId).single().then(({ data }) => {
      if (data) setJob(data as Job)
      setLoading(false)
      if (['disputed', 'cancellationRequested'].includes((data as Job)?.status)) fetchDispute()
    })
    fetchWalletAndEscrow()
    const channel = supabase.channel(`job-customer-${jobId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          const newJob = payload.new as Job
          setJob(newJob)
          if (newJob.status === 'workCostProposed') toast('💰 Worker proposed work cost — please review!', { duration: 5000 })
          if (newJob.status === 'inProgress') fetchWalletAndEscrow()
          if (['disputed', 'cancellationRequested'].includes(newJob.status)) fetchDispute()
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [jobId, user])

  const inspectionFee = job?.inspection_charges || 0
  const workCost = job?.work_cost || 0
  const stateIndex = job ? (STATES as readonly string[]).indexOf(job.status) : -1

  // ── Mark Inspection Complete → open confirmation modal ──
  // No deduction here — shown to confirm stored reward discount
  const markInspectionComplete = () => setShowInspectionConfirm(true)

  // ── Confirm inspection → deduct wallet NOW ──
  const confirmInspectionComplete = async () => {
    setSettlingInspection(true)
    // Step 1: mark inspectionDone (no money)
    const { error: statusErr } = await supabase.from('jobs').update({ status: 'inspectionDone' }).eq('id', jobId)
    if (statusErr) { setSettlingInspection(false); return toast.error(statusErr.message) }
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
    toast.success('Worker notified!')
  }

  // ── End at inspection → deduct wallet NOW using chosen discount ──
  const endAtInspection = async () => {
    const discount = useRewardEndInspection ? Math.min(rewardPoints, inspectionFee) : storedInspectionDiscount
    const { error } = await supabase.rpc('fn_settle_inspection_only', { p_job_id: jobId, p_reward_discount: discount })
    if (error) {
      if (error.message.includes('insufficient_reward_points')) return toast.error('Not enough reward points.')
      return toast.error(error.message)
    }
    await supabase.from('jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', jobId)
    const msg = discount > 0
      ? `Job ended. ₨${discount} reward discount applied — you paid ₨${inspectionFee - discount}.`
      : 'Job ended at inspection. Payment settled.'
    toast(msg)
    nav(`/customer/receipt/${jobId}`)
  }

  // ── Accept work cost: store reward preference, deduct worker bidding fee, NO customer deduction ──
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
      if (error.message.includes('insufficient_reward_points')) return toast.error('Not enough reward points.')
      return toast.error(error.message)
    }
    await supabase.from('jobs').update({ status: 'inProgress' }).eq('id', jobId)
    setStoredWorkDiscount(discount)
    toast.success('Work started! Payment will be collected when you mark job complete.')
    await fetchWalletAndEscrow()
  }

  const declineWorkCost = async () => {
    const { error } = await supabase.rpc('fn_settle_inspection_only', { p_job_id: jobId, p_reward_discount: storedInspectionDiscount })
    if (error) return toast.error(error.message)
    await supabase.from('jobs').update({ status: 'completed', completed_at: new Date().toISOString(), work_cost: 0 }).eq('id', jobId)
    toast('Work cost declined — inspection fee settled.')
    nav(`/customer/receipt/${jobId}`)
  }

  // ── Mark complete → open confirmation modal ──
  const markComplete = () => setShowCompleteConfirm(true)

  // ── Confirm complete → deduct wallet NOW using stored discount ──
  const confirmComplete = async (rateAfter: boolean) => {
    if (confirming) return
    setConfirming(true)
    // fn_complete_job reads stored work_reward_discount from escrow internally
    const { error } = await supabase.rpc('fn_complete_job', { p_job_id: jobId, p_reward_discount: 0 })
    if (error) { setConfirming(false); return toast.error(error.message) }
    setShowCompleteConfirm(false)
    const discount = storedWorkDiscount
    toast.success(discount > 0 ? `Job completed! ₨${discount} reward discount applied.` : 'Job completed!')
    if (rateAfter) nav(`/customer/review/${jobId}`)
    else nav('/customer/home')
  }

  const canRequestCancellation = job && ['bidAccepted', 'inspectionDone', 'proceedRequested', 'workCostProposed', 'workCostRejected'].includes(job.status)
  const canDispute = job && !['completed', 'cancelled', 'disputed', 'cancellationRequested', 'workCostRejected'].includes(job.status)

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] text-sm text-text-muted">Loading...</div>
  if (!job) return <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] text-sm text-text-muted">Job not found</div>

  const workDiscount = Math.min(rewardPoints, workCost > 0 ? workCost : 0)
  const inspectionDiscount = useRewardEndInspection ? Math.min(rewardPoints, inspectionFee) : storedInspectionDiscount
  const inspectionCustomerPays = inspectionFee - inspectionDiscount
  const workCustomerPays = workCost - storedWorkDiscount

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Header */}
      <div className="bg-primary px-6 pt-10 pb-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => nav(-1)}><IoArrowBack size={24} className="text-white" /></button>
          <div className="flex-1"><h1 className="text-white text-xl font-medium">Job Tracking</h1></div>
          <div className="flex items-center gap-2">
            {canDispute && (
              <button onClick={() => setShowDisputeModal(true)}
                className="flex items-center gap-1 bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-xl">
                <IoWarning size={14} /> Dispute
              </button>
            )}
            {canRequestCancellation && (
              <button onClick={() => setShowCancelModal(true)}
                className="flex items-center gap-1 bg-red-500/80 text-white text-xs font-medium px-3 py-1.5 rounded-xl">
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
          <p className="text-white/70 flex items-center gap-1.5 text-sm mt-1"><IoLocation size={14} /> {job.location}</p>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        {/* Progress */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-text-primary mb-5">Job Progress</p>
          <div className="flex items-start gap-1">
            {STATES.map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= stateIndex ? 'bg-primary text-white' : 'bg-border text-text-muted'}`}>
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

        {/* Worker */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
            {job.worker_photo ? <img src={job.worker_photo} className="w-full h-full object-cover" alt="worker" />
              : <span className="text-2xl font-bold text-primary">{job.worker_name?.[0] || 'W'}</span>}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">{job.worker_name}</p>
            <div className="flex items-center gap-1 mt-0.5"><IoStar size={13} className="text-yellow-400" /><span className="text-xs text-text-muted">Assigned Worker</span></div>
          </div>
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"><IoCall size={16} className="text-white" /></button>
            <button onClick={() => nav(`/chat/${jobId}`)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"><IoChatbubble size={16} className="text-text-muted" /></button>
          </div>
        </div>

        {/* Live map */}
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
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl space-y-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Worker proposes: <span className="text-primary">₨{job.work_cost}</span></p>
                  <p className="text-xs text-text-muted mt-0.5">Payment collected only when you mark the job complete.</p>
                </div>
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
                    You pay ₨{(job.work_cost || 0) - workDiscount} when job completes
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

        {/* Disputed / Cancellation Requested */}
        {(job.status === 'disputed' || job.status === 'cancellationRequested') && <DisputeBanner dispute={dispute} />}
        {(job.status === 'disputed' || job.status === 'cancellationRequested') && dispute && <DisputeThread dispute={dispute} job={job} />}

        {/* Step 1: Inspection */}
        {job.status === 'bidAccepted' && (
          <button onClick={markInspectionComplete} className="btn-primary">✅ Mark Inspection Complete</button>
        )}

        {/* Step 2: Proceed or end */}
        {job.status === 'inspectionDone' && (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <p className="text-sm font-semibold text-green-800 mb-1">Inspection Complete ✅</p>
              <p className="text-xs text-green-700">What would you like to do next?</p>
            </div>
            <button onClick={requestWorkCost} className="btn-primary">🔧 Proceed with Work — Request Cost</button>
            <div className="bg-white rounded-2xl border border-border p-4 space-y-3">
              <p className="text-sm font-medium text-text-primary">End job here — pay inspection fee only</p>
              {rewardPoints > 0 && (
                <button onClick={() => setUseRewardEndInspection(v => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-medium transition ${useRewardEndInspection ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-border text-text-secondary'}`}>
                  <span className="flex items-center gap-1.5"><IoGift size={14} /> Use {Math.min(rewardPoints, inspectionFee)} reward pts — save ₨{Math.min(rewardPoints, inspectionFee)}</span>
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${useRewardEndInspection ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                    {useRewardEndInspection && <span className="text-white text-[9px]">✓</span>}
                  </span>
                </button>
              )}
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Inspection Fee</span>
                  <span>₨{inspectionFee}</span>
                </div>
                {inspectionDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-700">
                    <span>Reward Discount</span>
                    <span>− ₨{inspectionDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
                  <span className="text-text-secondary">You Pay</span>
                  <span className="text-primary">₨{inspectionCustomerPays}</span>
                </div>
              </div>
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

        {/* Step 4: Mark complete */}
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
            <p className="text-xs text-text-muted text-center mb-5">Confirming will mark inspection as done. You can then proceed with work or end the job.</p>
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
            <p className="text-sm text-text-secondary mb-4">Payment will be deducted from your wallet now.</p>

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
                  <span className="text-text-secondary">Inspection Fee (paid earlier)</span>
                  <span className="font-medium text-text-muted">₨{inspectionFee}</span>
                </div>
              )}
              {workCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Work Cost</span>
                  <span className="font-medium">₨{workCost}</span>
                </div>
              )}
              {storedWorkDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Reward Discount</span>
                  <span className="font-medium">− ₨{storedWorkDiscount}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
                <span>You Pay Now</span>
                <span className="text-primary text-base">₨{workCustomerPays > 0 ? workCustomerPays : workCost}</span>
              </div>
            </div>

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

      {/* ── RAISE DISPUTE MODAL ── */}
      {showDisputeModal && job && (
        <RaiseDisputeModal
          job={job}
          type="dispute"
          onClose={() => setShowDisputeModal(false)}
          onSubmitted={() => {
            setShowDisputeModal(false)
            fetchDispute()
          }}
        />
      )}

      {/* ── CANCELLATION REQUEST MODAL ── */}
      {showCancelModal && job && (
        <RaiseDisputeModal
          job={job}
          type="cancellation"
          onClose={() => setShowCancelModal(false)}
          onSubmitted={() => {
            setShowCancelModal(false)
            fetchDispute()
          }}
        />
      )}
    </div>
  )
}
