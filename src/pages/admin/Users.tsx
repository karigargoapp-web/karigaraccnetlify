import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { IoSearch } from 'react-icons/io5'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'

export default function AdminUsers() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('*, wallets(balance, reward_points)')
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
    if (data) setUsers(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function suspend(userId: string) {
    const reason = prompt('Suspension reason:')
    if (!reason) return
    await supabase.from('users').update({ suspended_at: new Date().toISOString(), suspension_reason: reason }).eq('id', userId)
    await supabase.from('admin_actions').insert({ admin_id: user?.id, action_type: 'user_suspended', entity_type: 'user', entity_id: userId, notes: reason })
    toast.success('User suspended')
    fetchUsers()
  }

  async function unsuspend(userId: string) {
    await supabase.from('users').update({ suspended_at: null, suspension_reason: null }).eq('id', userId)
    toast.success('User unsuspended')
    fetchUsers()
  }

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search)
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
        <p className="text-sm text-gray-500 mt-1">{users.length} customers registered</p>
      </div>

      <div className="relative">
        <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, phone..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">City</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Wallet</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Disputes</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                        {u.profile_photo_url
                          ? <img src={u.profile_photo_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">{u.name?.[0]}</div>
                        }
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.phone || u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{u.city || '-'}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">₨{(u.wallets?.[0]?.balance || u.wallets?.balance || 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{u.wallets?.[0]?.reward_points || u.wallets?.reward_points || 0} pts</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.dispute_count > 2
                      ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{u.dispute_count} ⚠️</span>
                      : <span className="text-gray-600">{u.dispute_count}</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {u.suspended_at
                      ? <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">Suspended</span>
                      : <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Active</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {u.suspended_at
                      ? <button onClick={() => unsuspend(u.id)} className="text-xs text-green-600 hover:underline">Unsuspend</button>
                      : <button onClick={() => suspend(u.id)} className="text-xs text-red-600 hover:underline">Suspend</button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-gray-500">No customers found</div>}
        </div>
      )}
    </div>
  )
}
