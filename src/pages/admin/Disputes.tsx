import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { IoWarning, IoCheckmarkCircle } from 'react-icons/io5'

export default function AdminDisputes() {
  const navigate = useNavigate()
  const [disputes, setDisputes] = useState<any[]>([])
  const [tab, setTab] = useState<'open' | 'resolved'>('open')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDisputes()
  }, [tab])

  async function fetchDisputes() {
    setLoading(true)
    const { data } = await supabase
      .from('disputes')
      .select('*, jobs(title, customer_name, worker_name, inspection_charges, work_cost_total, city)')
      .eq('status', tab)
      .order('created_at', { ascending: false })
    if (data) setDisputes(data)
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dispute Management</h1>
        <p className="text-sm text-gray-500 mt-1">Resolve customer and worker disputes</p>
      </div>

      <div className="flex gap-2">
        {(['open', 'resolved'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : disputes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No {tab} disputes</div>
      ) : (
        <div className="space-y-4">
          {disputes.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {tab === 'open'
                    ? <IoWarning className="text-red-500 text-xl mt-0.5 flex-shrink-0" />
                    : <IoCheckmarkCircle className="text-green-500 text-xl mt-0.5 flex-shrink-0" />
                  }
                  <div>
                    <h3 className="font-semibold text-gray-900">{d.jobs?.title}</h3>
                    <p className="text-sm text-gray-500">{d.jobs?.customer_name} → {d.jobs?.worker_name} · {d.jobs?.city}</p>
                    <p className="text-sm text-gray-700 mt-2">{d.reason}</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="font-bold text-gray-900">₨{(d.jobs?.work_cost_total || d.jobs?.inspection_charges || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              {d.resolution_type && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>Resolution:</strong> {d.resolution_type} · Settled: ₨{(d.settled_amount || 0).toLocaleString()}
                  </p>
                  {d.admin_notes && <p className="text-sm text-green-700 mt-1">{d.admin_notes}</p>}
                </div>
              )}
              {tab === 'open' && (
                <button onClick={() => navigate(`/admin/disputes/${d.id}`)}
                  className="mt-4 w-full py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                  Resolve Dispute
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
