import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { IoArrowBack, IoCheckmark, IoClose, IoStar, IoBriefcase, IoWallet } from 'react-icons/io5'
import toast from 'react-hot-toast'
import { JOB_STATUS_LABELS } from '../../types'

export default function AdminWorkerDetail() {
  const { workerId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [worker, setWorker] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [wallet, setWallet] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [lightbox, setLightbox] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [workerId])

  async function fetchAll() {
    setLoading(true)
    const [{ data: u }, { data: wp }, { data: j }, { data: w }] = await Promise.all([
      supabase.from('users').select('*').eq('id', workerId).single(),
      supabase.from('worker_profiles').select('*').eq('user_id', workerId).maybeSingle(),
      supabase.from('jobs').select('id,title,status,created_at,work_cost_total,inspection_charges,customer_name').eq('worker_id', workerId).order('created_at', { ascending: false }).limit(10),
      supabase.from('wallets').select('*').eq('user_id', workerId).maybeSingle(),
    ])
    if (u) setWorker(u)
    if (wp) setProfile(wp)
    if (j) setJobs(j)
    if (w) setWallet(w)
    setLoading(false)
  }

  async function approve() {
    await supabase.from('users').update({ approval_status:'approved', verified:true, rejection_reason:null }).eq('id',workerId)
    await supabase.from('worker_profiles').update({ approval_reviewed_by:user?.id, approval_reviewed_at:new Date().toISOString() }).eq('user_id',workerId)
    await supabase.from('admin_actions').insert({ admin_id:user?.id, action_type:'worker_approved', entity_type:'user', entity_id:workerId })
    await supabase.from('notifications').insert({ user_id:workerId, type:'system', title:'Account Approved ✅', body:'Your account has been approved. You can now bid on jobs.' })
    toast.success('Worker approved')
    fetchAll()
  }

  async function reject() {
    if (!rejectReason.trim()) return
    await supabase.from('users').update({ approval_status:'rejected', rejection_reason:rejectReason }).eq('id',workerId)
    await supabase.from('admin_actions').insert({ admin_id:user?.id, action_type:'worker_rejected', entity_type:'user', entity_id:workerId, notes:rejectReason })
    await supabase.from('notifications').insert({ user_id:workerId, type:'system', title:'Account Not Approved', body:`Your account was not approved. Reason: ${rejectReason}` })
    toast.success('Worker rejected')
    setShowReject(false)
    fetchAll()
  }

  async function suspend() {
    const reason = prompt('Suspension reason:')
    if (!reason) return
    await supabase.from('users').update({ suspended_at:new Date().toISOString(), suspension_reason:reason }).eq('id',workerId)
    await supabase.from('admin_actions').insert({ admin_id:user?.id, action_type:'worker_suspended', entity_type:'user', entity_id:workerId, notes:reason })
    toast.success('Worker suspended')
    fetchAll()
  }

  async function unsuspend() {
    await supabase.from('users').update({ suspended_at:null, suspension_reason:null }).eq('id',workerId)
    toast.success('Worker unsuspended')
    fetchAll()
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"/></div>
  if (!worker) return <div className="text-center py-16 text-gray-400">Worker not found</div>

  const STATUS_COLOR: Record<string,string> = {
    completed:'text-green-600', cancelled:'text-red-400', pending:'text-gray-400',
    inProgress:'text-teal-600', paused:'text-orange-500', disputed:'text-red-600', cancellationRequested:'text-orange-500',
  }

  return (
    <div className="space-y-5">
      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-pointer">
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <p className="absolute bottom-6 text-white/60 text-sm">Click anywhere to close</p>
        </div>
      )}

      <button onClick={() => navigate('/admin/workers')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm">
        <IoArrowBack size={16}/> Back to Workers
      </button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 border-2 border-gray-200">
            {worker.profile_photo_url
              ? <img src={worker.profile_photo_url} alt="" className="w-full h-full object-cover"/>
              : <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-primary/60 bg-primary/10">{worker.name?.[0]?.toUpperCase()||'?'}</div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{worker.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                worker.approval_status==='approved' ? 'bg-green-100 text-green-700' :
                worker.approval_status==='pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {worker.approval_status}
              </span>
              {worker.suspended_at && <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full">Suspended</span>}
            </div>
            <p className="text-sm text-gray-500 mt-1">{worker.email}</p>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
              {worker.phone && <span>📱 {worker.phone}</span>}
              {worker.city && <span>📍 {worker.city}</span>}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <IoStar className="text-yellow-400 text-sm"/>
              <span className="text-sm text-gray-700">{worker.avg_rating||0} avg · {worker.total_reviews||0} reviews</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {worker.approval_status !== 'approved' && (
            <button onClick={approve} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              <IoCheckmark size={16}/> Approve
            </button>
          )}
          {worker.approval_status === 'pending' && (
            <button onClick={() => setShowReject(!showReject)} className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-700 bg-red-50 rounded-lg text-sm font-medium hover:bg-red-100">
              <IoClose size={16}/> Reject
            </button>
          )}
          {worker.suspended_at
            ? <button onClick={unsuspend} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Unsuspend</button>
            : <button onClick={suspend} className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100">Suspend</button>
          }
        </div>

        {showReject && (
          <div className="mt-3 flex gap-2">
            <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Rejection reason..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"/>
            <button onClick={reject} disabled={!rejectReason.trim()} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-40">Confirm</button>
          </div>
        )}

        {worker.rejection_reason && (
          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-xs font-medium text-red-600">Rejection reason:</p>
            <p className="text-sm text-red-700 mt-0.5">{worker.rejection_reason}</p>
          </div>
        )}
        {worker.suspension_reason && (
          <div className="mt-3 p-3 bg-orange-50 border border-orange-100 rounded-lg">
            <p className="text-xs font-medium text-orange-600">Suspension reason:</p>
            <p className="text-sm text-orange-700 mt-0.5">{worker.suspension_reason}</p>
          </div>
        )}
      </div>

      {wallet && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <IoWallet className="text-primary text-lg"/>
            <h2 className="font-semibold text-gray-900">Wallet</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">₨{wallet.balance.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Balance</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{wallet.reward_points}</p>
              <p className="text-xs text-gray-500 mt-1">Reward Points</p>
            </div>
          </div>
        </div>
      )}

      {profile && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Worker Profile</h2>
          {profile.skills?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((s:string) => <span key={s} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">{s}</span>)}
              </div>
            </div>
          )}
          {profile.bio && <div><p className="text-xs text-gray-500 mb-1">Bio</p><p className="text-sm text-gray-700 italic">"{profile.bio}"</p></div>}
          {profile.cnic && (
            <div><p className="text-xs text-gray-500 mb-1">CNIC Number</p><p className="text-sm font-mono font-semibold text-gray-800">{profile.cnic}</p></div>
          )}
          {(profile.cnic_front_url || profile.cnic_back_url) && (
            <div>
              <p className="text-xs text-gray-500 mb-2">CNIC Documents <span className="text-blue-500">(click to enlarge)</span></p>
              <div className="flex gap-3">
                {profile.cnic_front_url && (
                  <div className="cursor-pointer" onClick={() => setLightbox(profile.cnic_front_url)}>
                    <img src={profile.cnic_front_url} alt="Front" className="w-40 h-24 object-cover rounded-lg border border-gray-200 hover:opacity-90"/>
                    <p className="text-xs text-center text-gray-500 mt-1">Front</p>
                  </div>
                )}
                {profile.cnic_back_url && (
                  <div className="cursor-pointer" onClick={() => setLightbox(profile.cnic_back_url)}>
                    <img src={profile.cnic_back_url} alt="Back" className="w-40 h-24 object-cover rounded-lg border border-gray-200 hover:opacity-90"/>
                    <p className="text-xs text-center text-gray-500 mt-1">Back</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-lg font-bold text-gray-900">{profile.total_jobs||0}</p>
              <p className="text-xs text-gray-500">Jobs Done</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-lg font-bold text-gray-900">₨{(profile.total_earnings||0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">Total Earned</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-lg font-bold text-gray-900">{profile.avg_rating||0} ★</p>
              <p className="text-xs text-gray-500">Rating</p>
            </div>
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <IoBriefcase className="text-gray-400"/>
            <h2 className="font-semibold text-gray-900">Job History</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {jobs.map(j => (
              <div key={j.id} className="px-5 py-3.5 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{j.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{j.customer_name} · {new Date(j.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900">₨{((j.work_cost_total||j.inspection_charges)||0).toLocaleString()}</p>
                  <p className={`text-xs ${STATUS_COLOR[j.status]||'text-gray-400'}`}>{JOB_STATUS_LABELS[j.status as keyof typeof JOB_STATUS_LABELS] || j.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
