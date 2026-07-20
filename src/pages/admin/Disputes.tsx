import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { IoWarning, IoCheckmarkCircle, IoRefresh } from 'react-icons/io5'

export default function AdminDisputes() {
  const navigate = useNavigate()
  const [disputes, setDisputes] = useState<any[]>([])
  const [tab, setTab] = useState<'open'|'resolved'>('open')
  const [typeFilter, setTypeFilter] = useState<'all'|'dispute'|'cancellation'>('all')
  const [loading, setLoading] = useState(true)

  const fetchDisputes = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('disputes')
      .select('*, jobs(title,customer_name,worker_name,inspection_charges,work_cost_total,city,status), users!disputes_raised_by_fkey(name,email)')
      .eq('status', tab)
    if (typeFilter !== 'all') query = query.eq('type', typeFilter)
    const { data } = await query.order('created_at',{ascending:false})
    if (data) setDisputes(data)
    setLoading(false)
  }, [tab, typeFilter])

  useEffect(() => { fetchDisputes() }, [fetchDisputes])

  useEffect(() => {
    const channel = supabase.channel('admin-disputes')
      .on('postgres_changes',{event:'*',schema:'public',table:'disputes'}, fetchDisputes)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchDisputes])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispute Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resolve customer and worker disputes</p>
        </div>
        <button onClick={fetchDisputes} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <IoRefresh size={16} /> Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {(['open','resolved'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab===t ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {([
          { value: 'all', label: 'All' },
          { value: 'dispute', label: 'Disputes' },
          { value: 'cancellation', label: 'Cancellations' },
        ] as const).map(f => (
          <button key={f.value} onClick={() => setTypeFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter===f.value ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : disputes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
          <IoCheckmarkCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No {tab} disputes</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tab==='open' ? 'bg-red-100' : 'bg-green-100'}`}>
                  {tab==='open'
                    ? <IoWarning className="text-red-600 text-lg" />
                    : <IoCheckmarkCircle className="text-green-600 text-lg" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{d.jobs?.title || 'Unknown Job'}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${d.type === 'cancellation' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                      {d.type === 'cancellation' ? 'Cancellation' : 'Dispute'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                    <span>👤 {d.jobs?.customer_name}</span>
                    {d.jobs?.worker_name && <span>🔧 {d.jobs?.worker_name}</span>}
                    {d.jobs?.city && <span>📍 {d.jobs?.city}</span>}
                  </div>
                  <div className="mt-2 p-3 bg-red-50 rounded-lg">
                    <p className="text-xs font-medium text-red-600 mb-1">{d.type === 'cancellation' ? 'Cancellation Reason:' : 'Dispute Reason:'}</p>
                    <p className="text-sm text-red-800">{d.reason}</p>
                  </div>
                  {d.resolution_type && (
                    <div className="mt-2 p-3 bg-green-50 rounded-lg">
                      <p className="text-xs font-medium text-green-600 mb-1">Resolution: <span className="capitalize">{d.resolution_type}</span></p>
                      {d.settled_amount > 0 && <p className="text-sm text-green-700">Settled: ₨{d.settled_amount.toLocaleString()}</p>}
                      {d.admin_notes && <p className="text-sm text-green-700 mt-1">{d.admin_notes}</p>}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900">₨{((d.jobs?.work_cost_total||d.jobs?.inspection_charges)||0).toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(d.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</p>
                </div>
              </div>
              {tab==='open' && (
                <button onClick={() => navigate(`/admin/disputes/${d.id}`)}
                  className="mt-4 w-full py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
                  {d.type === 'cancellation' ? 'Review Cancellation Request →' : 'Resolve This Dispute →'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
