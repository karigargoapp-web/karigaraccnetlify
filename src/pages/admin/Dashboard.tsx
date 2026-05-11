import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { IoPeople, IoBriefcase, IoWarning, IoWallet, IoTrendingUp, IoTime, IoCheckmarkCircle, IoPauseCircle, IoRefresh } from 'react-icons/io5'

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

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ totalCustomers:0, totalWorkers:0, pendingApprovals:0, activeJobs:0, pausedJobs:0, openDisputes:0, completedToday:0, totalEscrow:0, platformRevenue:0 })
  const [recentJobs, setRecentJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [
        { count: c1 }, { count: c2 }, { count: c3 },
        { count: c4 }, { count: c5 }, { count: c6 }, { count: c7 },
        { data: escrowData }, { data: revenueData }, { data: jobs }
      ] = await Promise.all([
        supabase.from('users').select('*',{count:'exact',head:true}).eq('role','customer'),
        supabase.from('users').select('*',{count:'exact',head:true}).eq('role','worker'),
        supabase.from('users').select('*',{count:'exact',head:true}).eq('role','worker').eq('approval_status','pending'),
        supabase.from('jobs').select('*',{count:'exact',head:true}).in('status',['bidAccepted','inspectionDone','workCostProposed','workCostAccepted','inProgress']),
        supabase.from('jobs').select('*',{count:'exact',head:true}).eq('status','paused'),
        supabase.from('disputes').select('*',{count:'exact',head:true}).eq('status','open'),
        supabase.from('jobs').select('*',{count:'exact',head:true}).eq('status','completed').gte('completed_at', new Date().toISOString().split('T')[0]),
        supabase.from('escrow').select('total_locked').in('status',['inspection_held','work_held']),
        supabase.from('wallet_transactions').select('amount').eq('type','commission'),
        supabase.from('jobs').select('id,title,status,customer_name,worker_name,created_at,work_cost_total,inspection_charges,city').order('created_at',{ascending:false}).limit(10),
      ])
      setStats({
        totalCustomers: c1||0, totalWorkers: c2||0, pendingApprovals: c3||0,
        activeJobs: c4||0, pausedJobs: c5||0, openDisputes: c6||0, completedToday: c7||0,
        totalEscrow: escrowData?.reduce((s,r)=>s+(r.total_locked||0),0)||0,
        platformRevenue: revenueData?.reduce((s,r)=>s+(r.amount||0),0)||0,
      })
      if (jobs) setRecentJobs(jobs)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const channel = supabase.channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchAll])

  const cards = [
    { label:'Customers', value:stats.totalCustomers, icon:IoPeople, color:'text-blue-600', bg:'bg-blue-50', path:'/admin/users' },
    { label:'Workers', value:stats.totalWorkers, icon:IoPeople, color:'text-teal-600', bg:'bg-teal-50', path:'/admin/workers' },
    { label:'Active Jobs', value:stats.activeJobs, icon:IoBriefcase, color:'text-green-600', bg:'bg-green-50', path:'/admin/jobs' },
    { label:'Paused Jobs', value:stats.pausedJobs, icon:IoPauseCircle, color:'text-orange-600', bg:'bg-orange-50', path:'/admin/jobs?status=paused' },
    { label:'Open Disputes', value:stats.openDisputes, icon:IoWarning, color:'text-red-600', bg:'bg-red-50', path:'/admin/disputes' },
    { label:'Completed Today', value:stats.completedToday, icon:IoCheckmarkCircle, color:'text-green-700', bg:'bg-green-50', path:'/admin/jobs?status=completed' },
    { label:'Escrow Locked', value:`₨${stats.totalEscrow.toLocaleString()}`, icon:IoWallet, color:'text-purple-600', bg:'bg-purple-50', path:'/admin/wallets' },
    { label:'Platform Revenue', value:`₨${stats.platformRevenue.toLocaleString()}`, icon:IoTrendingUp, color:'text-primary', bg:'bg-green-50', path:'/admin/revenue' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Live platform overview</p>
        </div>
        <button onClick={() => { setRefreshing(true); fetchAll() }}
          className={`flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 ${refreshing ? 'opacity-50' : ''}`}>
          <IoRefresh size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {stats.pendingApprovals > 0 && (
        <div onClick={() => navigate('/admin/workers')}
          className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-amber-100 transition-colors">
          <IoTime className="text-amber-600 text-xl flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800">{stats.pendingApprovals} worker{stats.pendingApprovals>1?'s':''} awaiting approval</p>
            <p className="text-xs text-amber-600 mt-0.5">Click to review CNIC and approve</p>
          </div>
          <span className="text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded-full font-medium">Review →</span>
        </div>
      )}

      {stats.openDisputes > 0 && (
        <div onClick={() => navigate('/admin/disputes')}
          className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-red-100 transition-colors">
          <IoWarning className="text-red-600 text-xl flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">{stats.openDisputes} open dispute{stats.openDisputes>1?'s':''} need attention</p>
            <p className="text-xs text-red-600 mt-0.5">Click to resolve</p>
          </div>
          <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full font-medium">Resolve →</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c,i) => (
          <div key={i} onClick={() => navigate(c.path)}
            className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md hover:border-gray-200 transition-all">
            <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center mb-3`}>
              <c.icon className={`text-lg ${c.color}`} />
            </div>
            <p className="text-xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Jobs</h2>
          <button onClick={() => navigate('/admin/jobs')} className="text-xs text-primary font-medium hover:underline">View all →</button>
        </div>
        {recentJobs.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">No jobs yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentJobs.map(job => (
              <div key={job.id} onClick={() => navigate(`/admin/jobs/${job.id}`)}
                className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50 cursor-pointer">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{job.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {job.customer_name} → {job.worker_name || 'No worker'} {job.city ? `· ${job.city}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-700">
                    ₨{((job.work_cost_total||job.inspection_charges)||0).toLocaleString()}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[job.status]||'bg-gray-100 text-gray-600'}`}>
                    {job.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
