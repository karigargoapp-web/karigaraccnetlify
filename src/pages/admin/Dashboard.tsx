import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  IoPeople, IoBriefcase, IoWarning, IoWallet, IoTrendingUp,
  IoTime, IoCheckmarkCircle, IoPauseCircle, IoRefresh, IoArrowForward
} from 'react-icons/io5'
import { JOB_STATUS_LABELS } from '../../types'

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  bidAccepted: 'bg-blue-100 text-blue-700',
  inspectionDone: 'bg-violet-100 text-violet-700',
  workCostProposed: 'bg-amber-100 text-amber-700',
  workCostAccepted: 'bg-emerald-100 text-emerald-700',
  inProgress: 'bg-teal-100 text-teal-700',
  paused: 'bg-orange-100 text-orange-700',
  disputed: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-slate-100 text-slate-500',
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalCustomers: 0, totalWorkers: 0, pendingApprovals: 0,
    activeJobs: 0, pausedJobs: 0, openDisputes: 0,
    completedToday: 0, totalEscrow: 0, platformRevenue: 0, biddingFees: 0,
  })
  const [recentJobs, setRecentJobs] = useState<any[]>([])
  const [recentWorkers, setRecentWorkers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [
        { count: c1 }, { count: c2 }, { count: c3 },
        { count: c4 }, { count: c5 }, { count: c6 }, { count: c7 },
        { data: escrowData }, { data: commData }, { data: feeData },
        { data: jobs }, { data: workers },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'worker'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'worker').eq('approval_status', 'pending'),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).in('status', ['bidAccepted', 'inspectionDone', 'workCostProposed', 'workCostAccepted', 'inProgress']),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'paused'),
        supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', new Date().toISOString().split('T')[0]),
        supabase.from('escrow').select('total_locked').in('status', ['inspection_held', 'work_held']).limit(500),
        supabase.from('platform_revenue').select('amount').eq('type', 'commission').limit(1000),
        supabase.from('platform_revenue').select('amount').eq('type', 'bidding_fee').limit(1000),
        supabase.from('jobs').select('id,title,status,customer_name,worker_name,created_at,work_cost_total,inspection_charges,city,category').order('created_at', { ascending: false }).limit(8),
        supabase.from('users').select('id,name,email,city,created_at,approval_status').eq('role', 'worker').order('created_at', { ascending: false }).limit(5),
      ])
      setStats({
        totalCustomers: c1 || 0, totalWorkers: c2 || 0, pendingApprovals: c3 || 0,
        activeJobs: c4 || 0, pausedJobs: c5 || 0, openDisputes: c6 || 0,
        completedToday: c7 || 0,
        totalEscrow: escrowData?.reduce((s, r) => s + (r.total_locked || 0), 0) || 0,
        platformRevenue: commData?.reduce((s, r) => s + (r.amount || 0), 0) || 0,
        biddingFees: feeData?.reduce((s, r) => s + (r.amount || 0), 0) || 0,
      })
      if (jobs) setRecentJobs(jobs)
      if (workers) setRecentWorkers(workers)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const ch = supabase.channel('admin-db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchAll])

  const statCards = [
    { label: 'Total Customers', value: stats.totalCustomers, icon: IoPeople, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', path: '/admin/users' },
    { label: 'Total Workers', value: stats.totalWorkers, icon: IoPeople, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100', path: '/admin/workers' },
    { label: 'Active Jobs', value: stats.activeJobs, icon: IoBriefcase, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', path: '/admin/jobs' },
    { label: 'Paused Jobs', value: stats.pausedJobs, icon: IoPauseCircle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', path: '/admin/jobs?status=paused' },
    { label: 'Open Disputes', value: stats.openDisputes, icon: IoWarning, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', path: '/admin/disputes' },
    { label: 'Completed Today', value: stats.completedToday, icon: IoCheckmarkCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', path: '/admin/jobs?status=completed' },
    { label: 'Escrow Locked', value: `₨${stats.totalEscrow.toLocaleString()}`, icon: IoWallet, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', path: '/admin/wallets' },
    { label: 'Platform Revenue', value: `₨${(stats.platformRevenue + stats.biddingFees).toLocaleString()}`, icon: IoTrendingUp, color: 'text-primary', bg: 'bg-green-50', border: 'border-green-100', path: '/admin/revenue' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-500 text-sm mt-3">Loading dashboard...</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={() => { setRefreshing(true); fetchAll() }}
          className={`flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-all ${refreshing ? 'opacity-60' : ''}`}>
          <IoRefresh size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {(stats.pendingApprovals > 0 || stats.openDisputes > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.pendingApprovals > 0 && (
            <div onClick={() => navigate('/admin/workers')}
              className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl cursor-pointer hover:bg-amber-100 transition-colors shadow-sm">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <IoTime className="text-amber-600 text-xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-900">{stats.pendingApprovals} worker{stats.pendingApprovals > 1 ? 's' : ''} awaiting approval</p>
                <p className="text-xs text-amber-600 mt-0.5">Click to review CNIC and approve</p>
              </div>
              <span className="text-xs bg-amber-200 text-amber-800 px-3 py-1.5 rounded-full font-semibold flex-shrink-0">Review →</span>
            </div>
          )}
          {stats.openDisputes > 0 && (
            <div onClick={() => navigate('/admin/disputes')}
              className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-2xl cursor-pointer hover:bg-red-100 transition-colors shadow-sm">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <IoWarning className="text-red-600 text-xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-red-900">{stats.openDisputes} open dispute{stats.openDisputes > 1 ? 's' : ''} need attention</p>
                <p className="text-xs text-red-600 mt-0.5">Resolve to release payments</p>
              </div>
              <span className="text-xs bg-red-200 text-red-800 px-3 py-1.5 rounded-full font-semibold flex-shrink-0">Resolve →</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((c, i) => (
          <div key={i} onClick={() => navigate(c.path)}
            className={`bg-white rounded-2xl p-5 border ${c.border} shadow-sm cursor-pointer hover:shadow-md transition-all group`}>
            <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center mb-4`}>
              <c.icon className={`text-xl ${c.color}`} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">{c.label}</p>
            <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-xs text-primary font-medium">View details</p>
              <IoArrowForward size={10} className="text-primary" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Recent Jobs</h2>
              <p className="text-xs text-slate-400 mt-0.5">Latest job activity</p>
            </div>
            <button onClick={() => navigate('/admin/jobs')}
              className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline">
              View all <IoArrowForward size={12} />
            </button>
          </div>
          {recentJobs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <IoBriefcase size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No jobs yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentJobs.map(job => (
                <div key={job.id} onClick={() => navigate(`/admin/jobs/${job.id}`)}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <IoBriefcase size={16} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{job.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {job.customer_name} → {job.worker_name || 'No worker'}
                      {job.city && ` · ${job.city}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="text-sm font-bold text-slate-700">
                      ₨{((job.work_cost_total || job.inspection_charges) || 0).toLocaleString()}
                    </p>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[job.status] || 'bg-slate-100 text-slate-600'}`}>
                      {JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS] || job.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Recent Workers</h2>
              <p className="text-xs text-slate-400 mt-0.5">New registrations</p>
            </div>
            <button onClick={() => navigate('/admin/workers')}
              className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline">
              View all <IoArrowForward size={12} />
            </button>
          </div>
          {recentWorkers.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <IoPeople size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No workers yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentWorkers.map(w => (
                <div key={w.id} onClick={() => navigate(`/admin/workers/${w.id}`)}
                  className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 font-bold text-teal-700 text-sm">
                    {w.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{w.name}</p>
                    <p className="text-xs text-slate-400 truncate">{w.city || w.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    w.approval_status === 'approved' ? 'bg-green-100 text-green-700' :
                    w.approval_status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>{w.approval_status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Commissions Earned', value: `₨${stats.platformRevenue.toLocaleString()}`, sub: '10% of each job', color: 'bg-primary', icon: IoTrendingUp },
          { label: 'Bidding Fees Earned', value: `₨${stats.biddingFees.toLocaleString()}`, sub: '₨20 per job started', color: 'bg-violet-600', icon: IoWallet },
          { label: 'Pending Approvals', value: stats.pendingApprovals, sub: 'Workers waiting review', color: 'bg-amber-500', icon: IoTime },
        ].map((s, i) => (
          <div key={i} className={`${s.color} rounded-2xl p-5 text-white shadow-md`}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-white/80">{s.label}</p>
              <s.icon className="text-white/60 text-xl" />
            </div>
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-xs text-white/60 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
