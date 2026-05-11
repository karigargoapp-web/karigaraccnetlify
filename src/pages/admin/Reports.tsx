import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { IoWarning, IoFlag, IoBan, IoRefresh } from 'react-icons/io5'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'

export default function AdminReports() {
  const { user } = useAuth()
  const [flaggedWorkers, setFlaggedWorkers] = useState<any[]>([])
  const [flaggedCustomers, setFlaggedCustomers] = useState<any[]>([])
  const [cancelReasons, setCancelReasons] = useState<{reason:string;count:number;actor:string}[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    const [{ data:workers },{ data:customers },{ data:cancelled }] = await Promise.all([
      supabase.from('users').select('id,name,email,phone,city,dispute_count,cancellation_count,suspended_at,approval_status,avg_rating').eq('role','worker').or('dispute_count.gt.1,cancellation_count.gt.2').order('dispute_count',{ascending:false}).limit(20),
      supabase.from('users').select('id,name,email,phone,city,dispute_count,cancellation_count,suspended_at').eq('role','customer').or('dispute_count.gt.1,cancellation_count.gt.3').order('dispute_count',{ascending:false}).limit(20),
      supabase.from('jobs').select('cancellation_reason,cancellation_actor').eq('status','cancelled').not('cancellation_reason','is',null),
    ])
    if (workers) setFlaggedWorkers(workers)
    if (customers) setFlaggedCustomers(customers)
    if (cancelled) {
      const counts: Record<string,{count:number;actor:string}> = {}
      cancelled.forEach(j => {
        if (j.cancellation_reason) {
          const key = j.cancellation_reason
          counts[key] = counts[key] ? {...counts[key], count:counts[key].count+1} : {count:1, actor:j.cancellation_actor||'unknown'}
        }
      })
      setCancelReasons(Object.entries(counts).sort((a,b)=>b[1].count-a[1].count).map(([reason,{count,actor}])=>({reason,count,actor})))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  async function suspend(userId: string, name: string, role: string) {
    const reason = prompt(`Suspend ${name}?\nEnter reason:`)
    if (!reason) return
    await supabase.from('users').update({ suspended_at:new Date().toISOString(), suspension_reason:reason }).eq('id',userId)
    await supabase.from('admin_actions').insert({ admin_id:user?.id, action_type:`${role}_suspended`, entity_type:'user', entity_id:userId, notes:reason })
    toast.success(`${name} suspended`)
    fetchReports()
  }

  async function unsuspend(userId: string, name: string) {
    await supabase.from('users').update({ suspended_at:null, suspension_reason:null }).eq('id',userId)
    toast.success(`${name} unsuspended`)
    fetchReports()
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Flags</h1>
          <p className="text-sm text-gray-500 mt-0.5">Abuse detection and patterns</p>
        </div>
        <button onClick={fetchReports} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <IoRefresh size={16}/> Refresh
        </button>
      </div>

      {cancelReasons.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Top Cancellation Reasons</h2>
          <div className="space-y-3">
            {cancelReasons.slice(0,8).map((r,i) => {
              const max = cancelReasons[0].count
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-6 text-right font-medium">{r.count}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-gray-700 truncate">{r.reason}</p>
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{r.actor}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{width:`${(r.count/max)*100}%`}}/>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <IoFlag className="text-orange-500"/>
          <h2 className="font-semibold text-gray-900">Flagged Workers</h2>
          <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{flaggedWorkers.length}</span>
        </div>
        {flaggedWorkers.length === 0
          ? <div className="py-10 text-center text-gray-400 text-sm">No flagged workers</div>
          : <div className="divide-y divide-gray-50">
              {flaggedWorkers.map(w => (
                <div key={w.id} className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600">
                      {w.name?.[0]?.toUpperCase()||'?'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{w.name}</p>
                      <p className="text-xs text-gray-400">{w.city||w.email}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs font-medium ${w.dispute_count>2?'text-red-600':'text-orange-500'}`}>
                          {w.dispute_count} disputes
                        </span>
                        <span className={`text-xs font-medium ${w.cancellation_count>3?'text-red-600':'text-orange-500'}`}>
                          {w.cancellation_count} cancels
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {w.suspended_at
                      ? <><span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Suspended</span>
                          <button onClick={() => unsuspend(w.id,w.name)} className="text-xs text-green-600 hover:underline">Unsuspend</button></>
                      : <button onClick={() => suspend(w.id,w.name,'worker')} className="flex items-center gap-1 text-xs text-red-600 hover:underline"><IoBan size={12}/>Suspend</button>
                    }
                  </div>
                </div>
              ))}
            </div>
        }
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <IoWarning className="text-red-500"/>
          <h2 className="font-semibold text-gray-900">Flagged Customers</h2>
          <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{flaggedCustomers.length}</span>
        </div>
        {flaggedCustomers.length === 0
          ? <div className="py-10 text-center text-gray-400 text-sm">No flagged customers</div>
          : <div className="divide-y divide-gray-50">
              {flaggedCustomers.map(c => (
                <div key={c.id} className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center font-bold text-red-600">
                      {c.name?.[0]?.toUpperCase()||'?'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.city||c.email}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs font-medium ${c.dispute_count>2?'text-red-600':'text-orange-500'}`}>{c.dispute_count} disputes</span>
                        <span className={`text-xs font-medium ${c.cancellation_count>3?'text-red-600':'text-orange-500'}`}>{c.cancellation_count} cancels</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.suspended_at
                      ? <><span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Suspended</span>
                          <button onClick={() => unsuspend(c.id,c.name)} className="text-xs text-green-600 hover:underline">Unsuspend</button></>
                      : <button onClick={() => suspend(c.id,c.name,'customer')} className="flex items-center gap-1 text-xs text-red-600 hover:underline"><IoBan size={12}/>Suspend</button>
                    }
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  )
}
