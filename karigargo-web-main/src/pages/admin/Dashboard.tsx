import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoPeople, IoBriefcase, IoCheckmarkCircle, IoWallet, IoLogOut } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Job, User } from '../../types'

export default function AdminDashboard() {
  const nav = useNavigate()
  const { signOut } = useAuth()
  const [stats, setStats] = useState({ users: 0, activeJobs: 0, completedToday: 0, revenue: 0 })
  const [recentJobs, setRecentJobs] = useState<Job[]>([])
  const [recentUsers, setRecentUsers] = useState<User[]>([])

  useEffect(() => {
    const fetch = async () => {
      const today = new Date().toISOString().split('T')[0]
      const [usersRes, activeRes, completedRes, revenueRes, jobsRes, newUsersRes] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).not('status', 'in', '("completed","cancelled")'),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', today),
        supabase.from('jobs').select('platform_fee').eq('status', 'completed'),
        supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('users').select('*').order('created_at', { ascending: false }).limit(5),
      ])
      const totalRevenue = (revenueRes.data || []).reduce((s: number, j: any) => s + (j.platform_fee || 0), 0)
      setStats({ users: usersRes.count || 0, activeJobs: activeRes.count || 0, completedToday: completedRes.count || 0, revenue: totalRevenue })
      if (jobsRes.data) setRecentJobs(jobsRes.data as Job[])
      if (newUsersRes.data) setRecentUsers(newUsersRes.data as User[])
    }
    fetch()
  }, [])

  const cards = [
    { label: 'Total Users', value: stats.users, icon: <IoPeople size={22} />, color: 'bg-info/10 text-info' },
    { label: 'Active Jobs', value: stats.activeJobs, icon: <IoBriefcase size={22} />, color: 'bg-warning/10 text-warning' },
    { label: 'Done Today', value: stats.completedToday, icon: <IoCheckmarkCircle size={22} />, color: 'bg-primary/10 text-primary' },
    { label: 'Revenue', value: `₨${stats.revenue}`, icon: <IoWallet size={22} />, color: 'bg-rating/10 text-rating' },
  ]

  const navItems = [
    { label: 'Users', path: '/admin/users' },
    { label: 'Jobs', path: '/admin/jobs' },
    { label: 'Revenue', path: '/admin/revenue' },
    { label: 'Reports', path: '/admin/reports' },
  ]

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="top-bar flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Admin Dashboard</h1>
        <button onClick={async () => { await signOut(); nav('/login') }} className="text-white"><IoLogOut size={22} /></button>
      </div>

      <div className="flex-1 px-5 py-5 space-y-5 overflow-y-auto">
        {/* Nav pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {navItems.map(n => (
            <button key={n.path} onClick={() => nav(n.path)} className="shrink-0 px-4 py-2 bg-white border border-border rounded-full text-sm font-medium text-text-primary">{n.label}</button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {cards.map(c => (
            <div key={c.label} className="card p-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${c.color}`}>{c.icon}</div>
              <p className="text-xs text-text-muted">{c.label}</p>
              <p className="text-lg font-bold text-text-primary">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Recent jobs */}
        <div>
          <p className="section-title">Recent Jobs</p>
          <div className="card overflow-hidden">
            {recentJobs.map((j, i) => (
              <div key={j.id} className={`p-3 flex items-center justify-between text-sm ${i < recentJobs.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary truncate">{j.title}</p>
                  <p className="text-xs text-text-muted">{j.customer_name} → {j.worker_name || '—'}</p>
                </div>
                <span className={j.status === 'completed' ? 'pill-completed' : j.status === 'pending' ? 'pill-pending' : 'pill-active'}>{j.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent signups */}
        <div>
          <p className="section-title">Recent Signups</p>
          {recentUsers.map(u => (
            <div key={u.id} className="card p-3 mb-2 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{u.name[0]}</div>
              <div><p className="text-sm font-medium text-text-primary">{u.name}</p><p className="text-xs text-text-muted">{u.role} · {new Date(u.created_at).toLocaleDateString()}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
