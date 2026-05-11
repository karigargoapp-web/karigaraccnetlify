import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IoSearch, IoRefresh, IoBriefcase } from 'react-icons/io5'
import { PAKISTAN_CITIES } from '../../types'

type Tab = 'all'|'active'|'paused'|'disputed'|'completed'|'cancelled'

const STATUS_GROUPS: Record<Tab, string[]> = {
  all: [],
  active: ['pending','bidAccepted','inspectionDone','workCostProposed','workCostAccepted','inProgress'],
  paused: ['paused'],
  disputed: ['disputed'],
  completed: ['completed'],
  cancelled: ['cancelled'],
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  bidAccepted: 'bg-blue-100 text-blue-700',
  inspectionDone: 'bg-purple-100 text-purple-700',
  workCostProposed: 'bg-yellow-100 text-yellow-700',
  workCostAccepted: 'bg-emerald-100 text-emerald-700',
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
  const [tab, setTab] = useState<Tab>((searchParams.get('status') as Tab)||'all')
  const [counts, setCounts] = useState<Record<string,number>>({})
  const [loading, setLoading] = useState(true)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('jobs')
      .select('id,title,status,category,city,customer_name,worker_name,created_at,work_cost_total,inspection_charges,paused_at,completed_at')
      .order('created_at',{ascending:false}).limit(100)
    if (tab !== 'all') q = q.in('status', STATUS_GROUPS[tab])
    if (cityFilter) q = q.eq('city', cityFilter)
    const { data } = await q
    if (data) setJobs(data)

    const countPromises = Object.entries(STATUS_GROUPS).map(async ([key, statuses]) => {
      if (key === 'all') {
        const { count } = await supabase.from('jobs').select('*',{count:'exact',head:true})
        return [key, count||0]
      }
      const { count } = await supabase.from('jobs').select('*',{count:'exact',head:true}).in('status', statuses)
      return [key, count||0]
    })
    const results = await Promise.all(countPromises)
    setCounts(Object.fromEntries(results))
    setLoading(false)
  }, [tab, cityFilter])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  useEffect(() => {
    const channel = supabase.channel('admin-jobs')
      .on('postgres_changes',{event:'*',schema:'public',table:'jobs'}, fetchJobs)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchJobs])

  const filtered = jobs.filter(j =>
    !search ||
    j.title?.toLowerCase().includes(search.toLowerCase()) ||
    j.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    j.worker_name?.toLowerCase().includes(search.toLowerCase()) ||
    j.category?.toLowerCase().includes(search.toLowerCase())
  )

  const tabs: {key:Tab; label:string}[] = [
    {key:'all', label:`All (${counts.all||0})`},
    {key:'active', label:`Active (${counts.active||0})`},
    {key:'paused', label:`Paused (${counts.paused||0})`},
    {key:'disputed', label:`Disputed (${counts.disputed||0})`},
    {key:'completed', label:`Done (${counts.completed||0})`},
    {key:'cancelled', label:`Cancelled (${counts.cancelled||0})`},
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Monitoring</h1>
          <p className="text-sm text-gray-500 mt-0.5">All platform jobs in real time</p>
        </div>
        <button onClick={fetchJobs} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <IoRefresh size={16} /> Refresh
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${tab===t.key ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs, customer, worker..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
        </div>
        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white text-gray-600">
          <option value="">All Cities</option>
          {PAKISTAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
          <IoBriefcase size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No jobs found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(j => (
            <div key={j.id} onClick={() => navigate(`/admin/jobs/${j.id}`)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md cursor-pointer transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 truncate">{j.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLOR[j.status]||'bg-gray-100 text-gray-600'}`}>
                      {j.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 flex-wrap">
                    <span className="bg-gray-100 px-2 py-0.5 rounded">{j.category}</span>
                    {j.city && <span>📍 {j.city}</span>}
                    <span>{new Date(j.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                    <span>👤 {j.customer_name}</span>
                    {j.worker_name && <><span className="text-gray-300">→</span><span>🔧 {j.worker_name}</span></>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900">₨{((j.work_cost_total||j.inspection_charges)||0).toLocaleString()}</p>
                  <p className="text-xs text-gray-400 mt-1">View details →</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
