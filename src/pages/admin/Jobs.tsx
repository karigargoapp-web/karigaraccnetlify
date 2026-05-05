import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IoSearch, IoFilter } from 'react-icons/io5'
import { PAKISTAN_CITIES } from '../../types'

type StatusFilter = 'all' | 'active' | 'paused' | 'disputed' | 'completed' | 'cancelled'

const STATUS_GROUPS: Record<StatusFilter, string[]> = {
  all: [],
  active: ['pending', 'bidAccepted', 'inspectionDone', 'workCostProposed', 'workCostAccepted', 'inProgress'],
  paused: ['paused'],
  disputed: ['disputed'],
  completed: ['completed'],
  cancelled: ['cancelled'],
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  bidAccepted: 'bg-blue-100 text-blue-700',
  inspectionDone: 'bg-purple-100 text-purple-700',
  workCostProposed: 'bg-yellow-100 text-yellow-700',
  workCostAccepted: 'bg-green-100 text-green-700',
  inProgress: 'bg-teal-100 text-teal-700',
  paused: 'bg-orange-100 text-orange-700',
  disputed: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function AdminJobs() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [jobs, setJobs] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [tab, setTab] = useState<StatusFilter>((searchParams.get('status') as StatusFilter) || 'all')
  const [loading, setLoading] = useState(true)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('jobs')
      .select('id,title,status,category,city,customer_name,worker_name,created_at,work_cost_total,inspection_charges,paused_at')
      .order('created_at', { ascending: false })
      .limit(100)
    if (tab !== 'all') q = q.in('status', STATUS_GROUPS[tab])
    if (cityFilter) q = q.eq('city', cityFilter)
    const { data } = await q
    if (data) setJobs(data)
    setLoading(false)
  }, [tab, cityFilter])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const filtered = jobs.filter(j =>
    j.title?.toLowerCase().includes(search.toLowerCase()) ||
    j.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    j.worker_name?.toLowerCase().includes(search.toLowerCase())
  )

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'paused', label: 'Paused' },
    { key: 'disputed', label: 'Disputed' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Job Monitoring</h1>
        <p className="text-sm text-gray-500 mt-1">All platform jobs</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.key ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
          <option value="">All Cities</option>
          {PAKISTAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Job</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Worker</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">City</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(j => (
                <tr key={j.id} onClick={() => navigate(`/admin/jobs/${j.id}`)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{j.title}</p>
                    <p className="text-xs text-gray-400">{j.category}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{j.customer_name}</td>
                  <td className="px-4 py-3 text-gray-600">{j.worker_name || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{j.city || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    ₨{((j.work_cost_total || j.inspection_charges) || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[j.status] || 'bg-gray-100 text-gray-600'}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(j.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-gray-500">No jobs found</div>}
        </div>
      )}
    </div>
  )
}
