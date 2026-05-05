import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { IoSearch, IoCheckmark, IoClose, IoTime, IoEye } from 'react-icons/io5'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'

type Tab = 'pending' | 'approved' | 'rejected'

export default function AdminWorkers() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('pending')
  const [workers, setWorkers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchWorkers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('*, worker_profiles(*)')
      .eq('role', 'worker')
      .eq('approval_status', tab)
      .order('created_at', { ascending: false })
    if (data) setWorkers(data)
    setLoading(false)
  }, [tab])

  useEffect(() => { fetchWorkers() }, [fetchWorkers])

  async function approve(workerId: string) {
    const { error } = await supabase
      .from('users')
      .update({ approval_status: 'approved', verified: true, rejection_reason: null })
      .eq('id', workerId)
    if (error) { toast.error('Failed to approve'); return }
    await supabase.from('worker_profiles').update({
      approval_reviewed_by: user?.id,
      approval_reviewed_at: new Date().toISOString(),
    }).eq('user_id', workerId)
    await supabase.from('admin_actions').insert({
      admin_id: user?.id,
      action_type: 'worker_approved',
      entity_type: 'user',
      entity_id: workerId,
    })
    await supabase.from('notifications').insert({
      user_id: workerId,
      type: 'system',
      title: 'Account Approved ✅',
      body: 'Your account has been approved. You can now bid on jobs.',
    })
    toast.success('Worker approved')
    fetchWorkers()
  }

  async function reject(workerId: string, reason: string) {
    const { error } = await supabase
      .from('users')
      .update({ approval_status: 'rejected', rejection_reason: reason })
      .eq('id', workerId)
    if (error) { toast.error('Failed to reject'); return }
    await supabase.from('admin_actions').insert({
      admin_id: user?.id,
      action_type: 'worker_rejected',
      entity_type: 'user',
      entity_id: workerId,
      notes: reason,
    })
    await supabase.from('notifications').insert({
      user_id: workerId,
      type: 'system',
      title: 'Account Not Approved',
      body: `Your account was not approved. Reason: ${reason}`,
    })
    toast.success('Worker rejected')
    fetchWorkers()
  }

  const filtered = workers.filter(w =>
    w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.phone?.includes(search) ||
    w.city?.toLowerCase().includes(search.toLowerCase())
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Worker Management</h1>
        <p className="text-sm text-gray-500 mt-1">Approve or reject worker registrations</p>
      </div>

      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, city..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No {tab} workers found</div>
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
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const wp = worker.worker_profiles?.[0] || worker.worker_profiles

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
            {worker.profile_photo_url
              ? <img src={worker.profile_photo_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl font-bold">{worker.name?.[0]}</div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{worker.name}</h3>
              {worker.verified && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Email verified</span>}
            </div>
            <p className="text-sm text-gray-500">{worker.phone} · {worker.city}</p>
            {wp?.skills?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {wp.skills.map((s: string) => (
                  <span key={s} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{s}</span>
                ))}
              </div>
            )}
            {wp?.bio && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{wp.bio}</p>}
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          {wp?.cnic_front_url && (
            <a href={wp.cnic_front_url} target="_blank" rel="noreferrer"
              className="text-xs text-blue-600 hover:underline">CNIC Front</a>
          )}
          {wp?.cnic_back_url && (
            <a href={wp.cnic_back_url} target="_blank" rel="noreferrer"
              className="text-xs text-blue-600 hover:underline">CNIC Back</a>
          )}
          {wp?.cnic && <span className="text-xs text-gray-500">CNIC: {wp.cnic}</span>}
        </div>

        {worker.rejection_reason && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg">
            <p className="text-xs text-red-700">Rejection reason: {worker.rejection_reason}</p>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={onView}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <IoEye size={16} /> View Full Profile
          </button>
          {tab === 'pending' && (
            <>
              <button onClick={onApprove}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                <IoCheckmark size={16} /> Approve
              </button>
              <button onClick={() => setShowRejectInput(!showRejectInput)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100">
                <IoClose size={16} /> Reject
              </button>
            </>
          )}
          {tab === 'rejected' && (
            <button onClick={onApprove}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              <IoCheckmark size={16} /> Approve Now
            </button>
          )}
        </div>

        {showRejectInput && (
          <div className="mt-3 flex gap-2">
            <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
            <button onClick={() => { if (rejectReason.trim()) { onReject(rejectReason); setShowRejectInput(false) } }}
              disabled={!rejectReason.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              Confirm
            </button>
          </div>
        )}
      </div>
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-400">Registered {new Date(worker.created_at).toLocaleDateString()}</p>
      </div>
    </div>
  )
}
