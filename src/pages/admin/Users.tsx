import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { IoSearch, IoRefresh, IoPerson, IoWarning } from 'react-icons/io5'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'

export default function AdminUsers() {
  const { user } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('*, wallets(balance, reward_points)')
      .eq('role','customer')
      .order('created_at',{ascending:false})
    if (data) setUsers(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function suspend(userId: string, name: string) {
    const reason = prompt(`Suspend ${name}?\nEnter reason:`)
    if (!reason) return
    await supabase.from('users').update({ suspended_at:new Date().toISOString(), suspension_reason:reason }).eq('id',userId)
    await supabase.from('admin_actions').insert({ admin_id:user?.id, action_type:'user_suspended', entity_type:'user', entity_id:userId, notes:reason })
    toast.success(`${name} suspended`)
    fetchUsers()
  }

  async function unsuspend(userId: string, name: string) {
    await supabase.from('users').update({ suspended_at:null, suspension_reason:null }).eq('id',userId)
    toast.success(`${name} unsuspended`)
    fetchUsers()
  }

  const filtered = users.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search) ||
    u.city?.toLowerCase().includes(search.toLowerCase())
  )

  const getWallet = (u: any) => {
    if (Array.isArray(u.wallets)) return u.wallets[0]
    return u.wallets
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} registered customers</p>
        </div>
        <button onClick={fetchUsers} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <IoRefresh size={16} /> Refresh
        </button>
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
          <IoPerson size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No customers found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => {
            const wallet = getWallet(u)
            return (
              <div key={u.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-50 overflow-hidden flex-shrink-0 border border-gray-200">
                    {u.profile_photo_url
                      ? <img src={u.profile_photo_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-lg font-bold text-blue-400">{u.name?.[0]?.toUpperCase()||'?'}</div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{u.name||'No name'}</p>
                      {u.suspended_at
                        ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Suspended</span>
                        : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                      }
                      {u.dispute_count > 2 && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1"><IoWarning size={10}/>{u.dispute_count} disputes</span>}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{u.email}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      {u.phone && <span>📱 {u.phone}</span>}
                      {u.city && <span>📍 {u.city}</span>}
                      <span>Joined {new Date(u.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-gray-900">₨{(wallet?.balance||0).toLocaleString()}</p>
                    <p className="text-xs text-purple-600">{wallet?.reward_points||0} pts</p>
                    <p className="text-xs text-gray-400 mt-0.5">{u.cancellation_count||0} cancels</p>
                  </div>
                </div>
                {u.suspension_reason && (
                  <div className="mt-3 p-2.5 bg-red-50 rounded-lg">
                    <p className="text-xs text-red-700">Suspended: {u.suspension_reason}</p>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  {u.suspended_at
                    ? <button onClick={() => unsuspend(u.id, u.name)} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100">Unsuspend</button>
                    : <button onClick={() => suspend(u.id, u.name)} className="text-xs px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100">Suspend</button>
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
