import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { IoPeople, IoBriefcase, IoWarning, IoWallet, IoTrendingUp, IoTime, IoCheckmarkCircle, IoPauseCircle } from 'react-icons/io5'

interface Stats {
  totalUsers: number
  totalWorkers: number
  pendingApprovals: number
  activeJobs: number
  pausedJobs: number
  openDisputes: number
  completedToday: number
  totalEscrow: number
  platformRevenue: number
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalWorkers: 0, pendingApprovals: 0,
    activeJobs: 0, pausedJobs: 0, openDisputes: 0,
    completedToday: 0, totalEscrow: 0, platformRevenue: 0
  })
  const [recentJobs, setRecentJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    fetchRecentJobs()
  }, [])

  async function fetchStats() {
    const [
      { count: totalUsers },
      { count: totalWorkers },
      { count: pendingApprovals },
      { count: activeJobs },
      { count: pausedJobs },
      { count: openDisputes },
      { count: completedToday },
      { data: escrowData },
      { data: revenueData },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'worker'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'worker').eq('approval_status', 'pending'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).in('status', ['bidAccepted', 'inspectionDone', 'workCostProposed', 'workCostAccepted', 'inProgress']),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'paused'),
      supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', new Date().toISOString().split('T')[0]),
      supabase.from('escrow').select('total_locked').in('status', ['inspection_held', 'work_held']),
      supabase.from('jobs').select('platform_fee').eq('status', 'completed').not('platform_fee', 'is', null),
    ])
    const totalEscrow = escrowData?.reduce((s, r) => s + (r.total_locked || 0), 0) || 0
    const platformRevenue = revenueData?.reduce((s, r) => s + (r.platform_fee || 0), 0) || 0
    setStats({
      totalUsers: totalUsers || 0,
      totalWorkers: totalWorkers || 0,
      pendingApprovals: pendingApprovals || 0,
      activeJobs: activeJobs || 0,
      pausedJobs: pausedJobs || 0,
      openDisputes: openDisputes || 0,
      completedToday: completedToday || 0,
      totalEscrow,
      platformRevenue,
    })
    setLoading(false)
  }

  async function fetchRecentJobs() {
    const { data } = await supabase
      .from('jobs')
      .select('id,title,status,customer_name,worker_name,created_at,work_cost_total,inspection_charges')
      .order('created_at', { ascending: false })
      .limit(8)
    if (data) setRecentJobs(data)
  }

  const statusColor: Record<string, string> = {
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Platform overview</p>
      </div>

      {stats.pendingApprovals > 0 && (
        <div onClick={() => navigate('/admin/workers')} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-amber-100 transition-colors">
          <IoTime className="text-amber-600 text-xl flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800">{stats.pendingApprovals} worker{stats.pendingApprovals > 1 ? 's' : ''} awaiting approval</p>
            <p className="text-xs text-amber-600">Click to review</p>
          </div>
        </div>
      )}

      {stats.openDisputes > 0 && (
        <div onClick={() => navigate('/admin/disputes')} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-red-100 transition-colors">
          <IoWarning className="text-red-600 text-xl flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">{stats.openDisputes} open dispute{stats.openDisputes > 1 ? 's' : ''} need attention</p>
            <p className="text-xs text-red-600">Click to resolve</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Customers', value: stats.totalUsers, icon: IoPeople, color: 'text-blue-600', bg: 'bg-blue-50', action: () => navigate('/admin/users') },
          { label: 'Workers', value: stats.totalWorkers, icon: IoPeople, color: 'text-teal-600', bg: 'bg-teal-50', action: () => navigate('/admin/workers') },
          { label: 'Active Jobs', value: stats.activeJobs, icon: IoBriefcase, color: 'text-green-600', bg: 'bg-green-50', action: () => navigate('/admin/jobs') },
          { label: 'Paused Jobs', value: stats.pausedJobs, icon: IoPauseCircle, color: 'text-orange-600', bg: 'bg-orange-50', action: () => navigate('/admin/jobs?status=paused') },
          { label: 'Open Disputes', value: stats.openDisputes, icon: IoWarning, color: 'text-red-600', bg: 'bg-red-50', action: () => navigate('/admin/disputes') },
          { label: 'Completed Today', value: stats.completedToday, icon: IoCheckmarkCircle, color: 'text-green-600', bg: 'bg-green-50', action: () => navigate('/admin/jobs?status=completed') },
          { label: 'Escrow Locked', value: `₨${stats.totalEscrow.toLocaleString()}`, icon: IoWallet, color: 'text-purple-600', bg: 'bg-purple-50', action: () => navigate('/admin/wallets') },
          { label: 'Total Revenue', value: `₨${stats.platformRevenue.toLocaleString()}`, icon: IoTrendingUp, color: 'text-primary', bg: 'bg-green-50', action: () => navigate('/admin/revenue') },
        ].map((s, i) => (
          <div key={i} onClick={s.action} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>
              <s.icon className={`text-xl ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Jobs</h2>
          <button onClick={() => navigate('/admin/jobs')} className="text-sm text-primary font-medium">View all</button>
        </div>
        <div className="divide-y divide-gray-50">
          {recentJobs.map(job => (
            <div key={job.id} onClick={() => navigate(`/admin/jobs/${job.id}`)} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900 truncate">{job.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{job.customer_name} → {job.worker_name || 'No worker yet'}</p>
              </div>
              <div className="ml-4 flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">
                  ₨{((job.work_cost_total || job.inspection_charges) || 0).toLocaleString()}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[job.status] || 'bg-gray-100 text-gray-600'}`}>
                  {job.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
