import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { IoWarning, IoFlag, IoBan } from 'react-icons/io5'

export default function AdminReports() {
  const [flaggedWorkers, setFlaggedWorkers] = useState<any[]>([])
  const [flaggedCustomers, setFlaggedCustomers] = useState<any[]>([])
  const [cancellationReasons, setCancellationReasons] = useState<{ reason: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchReports() }, [])

  async function fetchReports() {
    const [{ data: workers }, { data: customers }, { data: cancelled }] = await Promise.all([
      supabase.from('users').select('id, name, phone, city, dispute_count, cancellation_count, suspended_at, approval_status')
        .eq('role', 'worker').or('dispute_count.gt.1,cancellation_count.gt.2').order('dispute_count', { ascending: false }).limit(20),
      supabase.from('users').select('id, name, phone, city, dispute_count, cancellation_count, suspended_at')
        .eq('role', 'customer').or('dispute_count.gt.1,cancellation_count.gt.3').order('dispute_count', { ascending: false }).limit(20),
      supabase.from('jobs').select('cancellation_reason, cancellation_actor').eq('status', 'cancelled').not('cancellation_reason', 'is', null),
    ])
    if (workers) setFlaggedWorkers(workers)
    if (customers) setFlaggedCustomers(customers)
    if (cancelled) {
      const counts: Record<string, number> = {}
      cancelled.forEach(j => { if (j.cancellation_reason) counts[j.cancellation_reason] = (counts[j.cancellation_reason] || 0) + 1 })
      setCancellationReasons(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })))
    }
    setLoading(false)
  }

  async function suspend(userId: string, role: string) {
    const reason = prompt('Suspension reason:')
    if (!reason) return
    await supabase.from('users').update({ suspended_at: new Date().toISOString(), suspension_reason: reason }).eq('id', userId)
    if (role === 'worker') {
      setFlaggedWorkers(prev => prev.map(w => w.id === userId ? { ...w, suspended_at: new Date().toISOString() } : w))
    } else {
      setFlaggedCustomers(prev => prev.map(c => c.id === userId ? { ...c, suspended_at: new Date().toISOString() } : c))
    }
  }

  async function unsuspend(userId: string, role: string) {
    await supabase.from('users').update({ suspended_at: null, suspension_reason: null }).eq('id', userId)
    if (role === 'worker') {
      setFlaggedWorkers(prev => prev.map(w => w.id === userId ? { ...w, suspended_at: null } : w))
    } else {
      setFlaggedCustomers(prev => prev.map(c => c.id === userId ? { ...c, suspended_at: null } : c))
    }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Flags</h1>
        <p className="text-sm text-gray-500 mt-1">Abuse detection and patterns</p>
      </div>

      {cancellationReasons.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Top Cancellation Reasons</h2>
          <div className="space-y-3">
            {cancellationReasons.slice(0, 8).map((r, i) => {
              const max = cancellationReasons[0].count
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-gray-700 w-52 flex-shrink-0 truncate">{r.reason}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-6 text-right">{r.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <IoFlag className="text-orange-500" />
          <h2 className="font-semibold text-gray-900">Flagged Workers</h2>
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full ml-auto">{flaggedWorkers.length}</span>
        </div>
        {flaggedWorkers.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">No flagged workers</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Worker</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Disputes</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cancellations</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {flaggedWorkers.map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{w.name}</p>
                    <p className="text-xs text-gray-400">{w.city}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${w.dispute_count > 2 ? 'text-red-600' : 'text-orange-500'}`}>{w.dispute_count}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${w.cancellation_count > 3 ? 'text-red-600' : 'text-orange-500'}`}>{w.cancellation_count}</span>
                  </td>
                  <td className="px-4 py-3">
                    {w.suspended_at
                      ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Suspended</span>
                      : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><IoWarning size={10} />Flagged</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {w.suspended_at
                      ? <button onClick={() => unsuspend(w.id, 'worker')} className="text-xs text-green-600 hover:underline">Unsuspend</button>
                      : <button onClick={() => suspend(w.id, 'worker')} className="text-xs text-red-600 hover:underline flex items-center gap-1"><IoBan size={12} /> Suspend</button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <IoFlag className="text-red-500" />
          <h2 className="font-semibold text-gray-900">Flagged Customers</h2>
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full ml-auto">{flaggedCustomers.length}</span>
        </div>
        {flaggedCustomers.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">No flagged customers</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Disputes</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cancellations</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {flaggedCustomers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.city}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${c.dispute_count > 2 ? 'text-red-600' : 'text-orange-500'}`}>{c.dispute_count}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${c.cancellation_count > 3 ? 'text-red-600' : 'text-orange-500'}`}>{c.cancellation_count}</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.suspended_at
                      ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Suspended</span>
                      : <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><IoWarning size={10} />Flagged</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {c.suspended_at
                      ? <button onClick={() => unsuspend(c.id, 'customer')} className="text-xs text-green-600 hover:underline">Unsuspend</button>
                      : <button onClick={() => suspend(c.id, 'customer')} className="text-xs text-red-600 hover:underline flex items-center gap-1"><IoBan size={12} /> Suspend</button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
