import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoArrowBack, IoCheckmarkCircle, IoChatbubble, IoLocation, IoCall, IoStar } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import WorkerTrackingMap from '../../components/WorkerTrackingMap'
import type { Job } from '../../types'
import toast from 'react-hot-toast'

const STATES = ['bidAccepted', 'inspectionDone', 'workCostProposed', 'workCostAccepted', 'completed'] as const
const STATE_LABELS = ['Bid Accepted', 'Inspection Done', 'Cost Proposed', 'Cost Approved', 'Completed']
const REJECTED_STATES = ['bidAccepted', 'inspectionDone', 'workCostProposed', 'workCostRejected', 'completed'] as const
const REJECTED_LABELS = ['Bid Accepted', 'Inspection Done', 'Cost Proposed', 'Cost Rejected', 'Completed']

export default function CustomerActiveJob() {
  const nav = useNavigate()
  const { jobId } = useParams()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!jobId) return
    const fetchJob = async () => {
      const { data } = await supabase.from('jobs').select('*').eq('id', jobId).single()
      if (data) {
        console.log('[ActiveJob] Initial job loaded:', data.status)
        setJob(data as Job)
      }
      setLoading(false)
    }
    fetchJob()
    const channel = supabase
      .channel(`job-${jobId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          console.log('[ActiveJob] Realtime update received:', payload.new)
          const newJob = payload.new as Job
          console.log('[ActiveJob] Status changed to:', newJob.status)
          setJob(newJob)
          // Show toast notification for status changes
          if (newJob.status === 'inspectionDone') {
            toast('✅ Worker completed inspection!', { duration: 4000 })
          } else if (newJob.status === 'workCostProposed') {
            toast('💰 Worker proposed work cost - please review!', { duration: 5000 })
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [jobId])

  const isRejected = job?.status === 'workCostRejected'
  const currentStates = isRejected ? REJECTED_STATES : STATES
  const currentLabels = isRejected ? REJECTED_LABELS : STATE_LABELS
  const stateIndex = job ? (currentStates as readonly string[]).indexOf(job.status) : -1
  const isCaseA = job?.status === 'workCostAccepted' || (job?.status === 'completed' && (job?.work_cost || 0) > 0)

  const inspectionFee = job?.inspection_charges || 0
  const workCost = isCaseA ? (job?.work_cost || 0) : 0
  const total = inspectionFee + workCost
  const platformFee = Math.round(total * 0.1)

  const acceptWorkCost = async () => {
    await supabase.from('jobs').update({ status: 'workCostAccepted' }).eq('id', jobId)
    toast.success('Work cost accepted!')
  }
  const declineWorkCost = async () => {
    await supabase.from('jobs').update({ status: 'workCostRejected', work_cost: 0 }).eq('id', jobId)
    toast('Work cost declined — only inspection fee applies.')
  }
  const markComplete = async () => {
    await supabase.from('jobs').update({ status: 'completed' }).eq('id', jobId)
    setShowConfirm(false)
    toast.success('Job marked as complete!')
    nav(`/customer/receipt/${jobId}`)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] text-sm text-text-muted">Loading...</div>
  if (!job) return <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] text-sm text-text-muted">Job not found</div>

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Green header */}
      <div className="bg-primary px-6 pt-10 pb-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => nav(-1)}><IoArrowBack size={24} className="text-white" /></button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-medium">Job Tracking</h1>
          </div>
          <div className="flex items-center gap-2">
            {job.status === 'bidAccepted' && (
              <button onClick={() => nav(`/customer/tracking/${jobId}`)}
                className="flex items-center gap-1.5 bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-xl">
                <IoLocation size={14} /> Track
              </button>
            )}
            <button onClick={() => nav(`/chat/${jobId}`)}
              className="flex items-center gap-1.5 bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-xl">
              <IoChatbubble size={14} /> Chat
            </button>
          </div>
        </div>

        {/* Task info card */}
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
            {currentStates.map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition
                  ${i <= stateIndex ? 'bg-primary text-white' : 'bg-border text-text-muted'}`}>
                  {i <= stateIndex ? <IoCheckmarkCircle size={18} /> : i + 1}
                </div>
                <p className={`text-[9px] mt-1 text-center leading-tight ${i <= stateIndex ? 'text-primary font-medium' : 'text-text-muted'}`}>
                  {currentLabels[i]}
                </p>
              </div>
            ))}
          </div>
          <div className="flex mx-3.5 -mt-[38px] mb-6">
            {currentStates.slice(0, -1).map((_, i) => (
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

        {/* Live worker map */}
        {job.worker_id && job.status === 'bidAccepted' && (
          <WorkerTrackingMap workerId={job.worker_id} jobId={job.id} workerName={job.worker_name || 'Worker'} />
        )}

        {/* Cost details */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-text-primary mb-4">Payment Details</p>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Inspection Fee</span>
              <span className="font-medium">PKR {inspectionFee}</span>
            </div>
            {stateIndex < STATES.indexOf('workCostProposed') && (
              <p className="text-xs text-warning">⏳ Waiting for worker to complete inspection…</p>
            )}
            {job.status === 'workCostProposed' && (
              <div className="mt-1 p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
                <p className="text-sm text-text-primary font-medium">
                  Work Cost Proposed: <span className="text-primary font-semibold">PKR {job.work_cost}</span>
                </p>
                <p className="text-xs text-text-muted mt-1">Accept to proceed. Decline to pay inspection fee only.</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={acceptWorkCost} className="flex-1 py-2.5 bg-primary text-white text-sm font-medium rounded-xl">✅ Accept</button>
                  <button onClick={declineWorkCost} className="flex-1 py-2.5 border border-border text-sm text-text-secondary rounded-xl">❌ Decline</button>
                </div>
              </div>
            )}
            {job.status === 'workCostRejected' && (
              <div className="p-3 bg-red-50 rounded-xl">
                <p className="text-sm text-red-700 font-medium">Work cost declined — only inspection fee applies.</p>
              </div>
            )}
            {job.status === 'workCostAccepted' && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Work Cost</span>
                <span className="font-medium">PKR {job.work_cost}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {job.status !== 'completed' ? (
          <button onClick={() => setShowConfirm(true)} className="btn-primary">Mark Job Complete</button>
        ) : (
          <button onClick={() => nav(`/customer/receipt/${job.id}`)} className="btn-primary">View Receipt</button>
        )}
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-[430px] rounded-t-3xl p-6 animate-slide-up">
            <h3 className="text-lg font-semibold text-text-primary mb-1">Confirm Completion</h3>
            <p className="text-sm text-text-secondary mb-4">
              Review the payment breakdown below
            </p>
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-sm"><span className="text-text-secondary">Inspection Fee</span><span className="font-medium">PKR {inspectionFee}</span></div>
              {isCaseA && <div className="flex justify-between text-sm"><span className="text-text-secondary">Work Cost</span><span className="font-medium">PKR {workCost}</span></div>}
              <div className="flex justify-between text-sm"><span className="text-text-secondary">Platform Fee (10%)</span><span className="font-medium">PKR {platformFee}</span></div>
              <div className="flex justify-between text-sm font-semibold border-t border-border pt-3">
                <span>Total</span><span className="text-primary text-base">PKR {total + platformFee}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={markComplete} className="btn-primary flex-1">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
