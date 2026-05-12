import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { IoSearch, IoCheckmark, IoClose, IoEye, IoRefresh, IoPersonCircle } from 'react-icons/io5'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'

type Tab = 'pending' | 'approved' | 'rejected'

export default function AdminWorkers() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('pending')
  const [workers, setWorkers] = useState<any[]>([])
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchWorkers = useCallback(async () => {
    setLoading(true)
    const [{ data: usersData }, { count: p }, { count: a }, { count: r }] = await Promise.all([
      supabase.from('users').select('*').eq('role', 'worker').eq('approval_status', tab).order('created_at', { ascending: false }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'worker').eq('approval_status', 'pending'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'worker').eq('approval_status', 'approved'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'worker').eq('approval_status', 'rejected'),
    ])
    if (usersData && usersData.length > 0) {
      const ids = usersData.map(u => u.id)
      const { data: profiles } = await supabase.from('worker_profiles').select('*').in('user_id', ids)
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]))
      setWorkers(usersData.map(u => ({ ...u, worker_profile: profileMap[u.id] || null })))
    } else {
      setWorkers([])
    }
    setCounts({ pending: p || 0, approved: a || 0, rejected: r || 0 })
    setLoading(false)
  }, [tab])

  useEffect(() => { fetchWorkers() }, [fetchWorkers])

  useEffect(() => {
    const channel = supabase.channel('admin-workers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: 'role=eq.worker' }, fetchWorkers)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchWorkers])

  async function approve(workerId: string) {
    const { error } = await supabase.from('users').update({ approval_status:'approved', verified:true, rejection_reason:null }).eq('id',workerId)
    if (error) { toast.error('Failed to approve'); return }
    await supabase.from('worker_profiles').update({ approval_reviewed_by:user?.id, approval_reviewed_at:new Date().toISOString() }).eq('user_id',workerId)
    await supabase.from('admin_actions').insert({ admin_id:user?.id, action_type:'worker_approved', entity_type:'user', entity_id:workerId })
    await supabase.from('notifications').insert({ user_id:workerId, type:'system', title:'Account Approved ✅', body:'Your account has been approved. You can now bid on jobs.' })
    toast.success('Worker approved successfully')
    fetchWorkers()
  }

  async function reject(workerId: string, reason: string) {
    const { error } = await supabase.from('users').update({ approval_status:'rejected', rejection_reason:reason }).eq('id',workerId)
    if (error) { toast.error('Failed to reject'); return }
    await supabase.from('admin_actions').insert({ admin_id:user?.id, action_type:'worker_rejected', entity_type:'user', entity_id:workerId, notes:reason })
    await supabase.from('notifications').insert({ user_id:workerId, type:'system', title:'Account Not Approved', body:`Your account was not approved. Reason: ${reason}` })
    toast.success('Worker rejected')
    fetchWorkers()
  }

  const filtered = workers.filter(w =>
    !search ||
    w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.email?.toLowerCase().includes(search.toLowerCase()) ||
    w.phone?.includes(search) ||
    w.city?.toLowerCase().includes(search.toLowerCase())
  )

  const tabs: { key: Tab; label: string }[] = [
    { key:'pending', label:`Pending (${counts.pending})` },
    { key:'approved', label:`Approved (${counts.approved})` },
    { key:'rejected', label:`Rejected (${counts.rejected})` },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Worker Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review CNIC, approve or reject registrations</p>
        </div>
        <button onClick={fetchWorkers} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <IoRefresh size={16} /> Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab===t.key ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, phone, city..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
          <IoPersonCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No {tab} workers found</p>
          <p className="text-gray-400 text-sm mt-1">Workers will appear here once they sign up</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(w => (
            <WorkerCard key={w.id} worker={w} tab={tab}
              onApprove={() => approve(w.id)}
              onReject={(reason: string) => reject(w.id, reason)}
              onView={() => navigate(`/admin/workers/${w.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

function WorkerCard({ worker, tab, onApprove, onReject, onView }: any) {
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [approving, setApproving] = useState(false)
  const wp = worker.worker_profile

  async function handleApprove() {
    setApproving(true)
    await onApprove()
    setApproving(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 border-2 border-gray-200">
            {worker.profile_photo_url
              ? <img src={worker.profile_photo_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400 bg-primary/10 text-primary">
                  {worker.name?.[0]?.toUpperCase() || '?'}
                </div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-base">{worker.name || 'No name'}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                worker.approval_status==='approved' ? 'bg-green-100 text-green-700' :
                worker.approval_status==='pending' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'}`}>
                {worker.approval_status}
              </span>
              {worker.verified && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">✓ Email verified</span>}
            </div>
            <p className="text-sm text-gray-600 mt-0.5">{worker.email}</p>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              {worker.phone && <span>📱 {worker.phone}</span>}
              {worker.city && <span>📍 {worker.city}</span>}
            </div>
            {wp?.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {wp.skills.map((s: string) => (
                  <span key={s} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            )}
            {wp?.bio && <p className="text-sm text-gray-600 mt-2 line-clamp-2 italic">"{wp.bio}"</p>}
          </div>
        </div>

        {wp?.cnic && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-500 mb-1">CNIC Number</p>
            <p className="text-sm font-mono font-semibold text-gray-800">{wp.cnic}</p>
          </div>
        )}

        {(wp?.cnic_front_url || wp?.cnic_back_url) && (
          <div className="mt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">CNIC Documents</p>
            <div className="flex gap-3">
              {wp.cnic_front_url && (
                <a href={wp.cnic_front_url} target="_blank" rel="noreferrer" className="group">
                  <img src={wp.cnic_front_url} alt="CNIC Front" className="w-36 h-22 object-cover rounded-lg border border-gray-200 group-hover:opacity-90 transition-opacity" />
                  <p className="text-xs text-center text-blue-600 mt-1">Front ↗</p>
                </a>
              )}
              {wp.cnic_back_url && (
                <a href={wp.cnic_back_url} target="_blank" rel="noreferrer" className="group">
                  <img src={wp.cnic_back_url} alt="CNIC Back" className="w-36 h-22 object-cover rounded-lg border border-gray-200 group-hover:opacity-90 transition-opacity" />
                  <p className="text-xs text-center text-blue-600 mt-1">Back ↗</p>
                </a>
              )}
            </div>
          </div>
        )}

        {worker.rejection_reason && (
          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-xs font-medium text-red-600">Rejection reason:</p>
            <p className="text-sm text-red-700 mt-0.5">{worker.rejection_reason}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onView}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <IoEye size={15} /> Full Profile
          </button>
          {(tab === 'pending' || tab === 'rejected') && (
            <button onClick={handleApprove} disabled={approving}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50">
              <IoCheckmark size={15} /> {approving ? 'Approving...' : 'Approve'}
            </button>
          )}
          {tab === 'pending' && (
            <button onClick={() => setShowReject(!showReject)}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
              <IoClose size={15} /> Reject
            </button>
          )}
        </div>

        {showReject && (
          <div className="mt-3 flex gap-2">
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
            <button onClick={() => { if(reason.trim()){onReject(reason);setShowReject(false);setReason('')} }}
              disabled={!reason.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-red-700">
              Confirm
            </button>
          </div>
        )}
      </div>
      <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <p className="text-xs text-gray-400">Registered {new Date(worker.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p>
        {wp?.total_jobs > 0 && <p className="text-xs text-gray-500">{wp.total_jobs} jobs completed</p>}
      </div>
    </div>
  )
}
