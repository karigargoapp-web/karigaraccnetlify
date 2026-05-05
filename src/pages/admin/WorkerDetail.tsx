import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { IoArrowBack, IoCheckmark, IoClose, IoStar } from 'react-icons/io5'
import toast from 'react-hot-toast'

export default function AdminWorkerDetail() {
  const { workerId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [worker, setWorker] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)

  useEffect(() => {
    fetchWorker()
    fetchJobs()
  }, [workerId])

  async function fetchWorker() {
    const { data: u } = await supabase.from('users').select('*').eq('id', workerId).single()
    const { data: wp } = await supabase.from('worker_profiles').select('*').eq('user_id', workerId).single()
    setWorker(u)
    setProfile(wp)
  }

  async function fetchJobs() {
    const { data } = await supabase
      .from('jobs')
      .select('id,title,status,created_at,work_cost_total,inspection_charges')
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false })
      .limit(10)
    if (data) setJobs(data)
  }

  async function approve() {
    await supabase.from('users').update({ approval_status: 'approved', verified: true, rejection_reason: null }).eq('id', workerId)
    await supabase.from('worker_profiles').update({ approval_reviewed_by: user?.id, approval_reviewed_at: new Date().toISOString() }).eq('user_id', workerId)
    await supabase.from('admin_actions').insert({ admin_id: user?.id, action_type: 'worker_approved', entity_type: 'user', entity_id: workerId })
    await supabase.from('notifications').insert({ user_id: workerId, type: 'system', title: 'Account Approved ✅', body: 'Your account has been approved. You can now bid on jobs.' })
    toast.success('Worker approved')
    fetchWorker()
  }

  async function reject() {
    if (!rejectReason.trim()) return
    await supabase.from('users').update({ approval_status: 'rejected', rejection_reason: rejectReason }).eq('id', workerId)
    await supabase.from('admin_actions').insert({ admin_id: user?.id, action_type: 'worker_rejected', entity_type: 'user', entity_id: workerId, notes: rejectReason })
    await supabase.from('notifications').insert({ user_id: workerId, type: 'system', title: 'Account Not Approved', body: `Your account was not approved. Reason: ${rejectReason}` })
    toast.success('Worker rejected')
    setShowReject(false)
    fetchWorker()
  }

  async function suspend() {
    const reason = prompt('Suspension reason:')
    if (!reason) return
    await supabase.from('users').update({ suspended_at: new Date().toISOString(), suspension_reason: reason }).eq('id', workerId)
    await supabase.from('admin_actions').insert({ admin_id: user?.id, action_type: 'worker_suspended', entity_type: 'user', entity_id: workerId, notes: reason })
    toast.success('Worker suspended')
    fetchWorker()
  }

  async function unsuspend() {
    await supabase.from('users').update({ suspended_at: null, suspension_reason: null }).eq('id', workerId)
    toast.success('Worker unsuspended')
    fetchWorker()
  }

  if (!worker) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}

      <button onClick={() => navigate('/admin/workers')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <IoArrowBack /> Back to Workers
      </button>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
            {worker.profile_photo_url
              ? <img src={worker.profile_photo_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-400">{worker.name?.[0]}</div>
            }
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{worker.name}</h1>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                worker.approval_status === 'approved' ? 'bg-green-100 text-green-700' :
                worker.approval_status === 'pending' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>{worker.approval_status}</span>
              {worker.suspended_at && <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full">Suspended</span>}
            </div>
            <p className="text-gray-600 mt-1">{worker.phone} · {worker.email}</p>
            <p className="text-gray-500 text-sm">{worker.city}</p>
            <div className="flex items-center gap-1 mt-1">
              <IoStar className="text-yellow-400 text-sm" />
              <span className="text-sm text-gray-700">{worker.avg_rating || 0} · {worker.total_reviews || 0} reviews</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {worker.approval_status === 'pending' && (
            <>
              <button onClick={approve} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                <IoCheckmark /> Approve
              </button>
              <button onClick={() => setShowReject(!showReject)} className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-700 bg-red-50 rounded-lg text-sm font-medium hover:bg-red-100">
                <IoClose /> Reject
              </button>
            </>
          )}
          {worker.approval_status === 'rejected' && (
            <button onClick={approve} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              <IoCheckmark /> Approve Now
            </button>
          )}
          {worker.suspended_at
            ? <button onClick={unsuspend} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Unsuspend</button>
            : <button onClick={suspend} className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100">Suspend</button>
          }
        </div>

        {showReject && (
          <div className="mt-4 flex gap-2">
            <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Rejection reason..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
            <button onClick={reject} disabled={!rejectReason.trim()} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">Confirm Reject</button>
          </div>
        )}

        {worker.rejection_reason && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700"><strong>Rejection reason:</strong> {worker.rejection_reason}</p>
          </div>
        )}
        {worker.suspension_reason && (
          <div className="mt-4 p-3 bg-orange-50 rounded-lg">
            <p className="text-sm text-orange-700"><strong>Suspension reason:</strong> {worker.suspension_reason}</p>
          </div>
        )}
      </div>

      {profile && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Worker Profile</h2>
          {profile.skills?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Skills</p>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((s: string) => <span key={s} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">{s}</span>)}
              </div>
            </div>
          )}
          {profile.bio && <div><p className="text-xs text-gray-500 mb-1">Bio</p><p className="text-sm text-gray-700">{profile.bio}</p></div>}
          {profile.cnic && <div><p className="text-xs text-gray-500 mb-1">CNIC</p><p className="text-sm font-mono text-gray-700">{profile.cnic}</p></div>}
          <div>
            <p className="text-xs text-gray-500 mb-2">CNIC Documents</p>
            <div className="flex gap-3">
              {profile.cnic_front_url && (
                <div className="cursor-pointer" onClick={() => setLightbox(profile.cnic_front_url)}>
                  <img src={profile.cnic_front_url} alt="CNIC Front" className="w-40 h-24 object-cover rounded-lg border border-gray-200 hover:opacity-90" />
                  <p className="text-xs text-center text-gray-500 mt-1">Front</p>
                </div>
              )}
              {profile.cnic_back_url && (
                <div className="cursor-pointer" onClick={() => setLightbox(profile.cnic_back_url)}>
                  <img src={profile.cnic_back_url} alt="CNIC Back" className="w-40 h-24 object-cover rounded-lg border border-gray-200 hover:opacity-90" />
                  <p className="text-xs text-center text-gray-500 mt-1">Back</p>
                </div>
              )}
            </div>
          </div>
          {profile.certificate_urls?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Certificates</p>
              <div className="flex gap-3 flex-wrap">
                {profile.certificate_urls.map((url: string, i: number) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Certificate {i + 1}</a>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{profile.total_jobs || 0}</p>
              <p className="text-xs text-gray-500">Total Jobs</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">₨{(profile.total_earnings || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">Total Earned</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{profile.avg_rating || 0} ★</p>
              <p className="text-xs text-gray-500">Avg Rating</p>
            </div>
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100"><h2 className="font-semibold text-gray-900">Job History</h2></div>
          <div className="divide-y divide-gray-50">
            {jobs.map(j => (
              <div key={j.id} className="px-6 py-3 flex justify-between items-center">
                <p className="text-sm text-gray-800">{j.title}</p>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">₨{((j.work_cost_total || j.inspection_charges) || 0).toLocaleString()}</span>
                  <span className="text-xs text-gray-400">{j.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
