import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoStar, IoTrendingUp } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Job } from '../../types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Earnings() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('jobs').select('*').eq('worker_id', user.id).eq('status', 'completed').order('completed_at', { ascending: false })
      .then(({ data }) => { if (data) setJobs(data as Job[]); setLoading(false) })
  }, [user])

  const totalGross = jobs.reduce((s, j) => s + (j.inspection_charges || 0) + (j.work_cost || 0), 0)
  const totalFees = jobs.reduce((s, j) => s + (j.platform_fee || 0), 0)
  const totalNet = totalGross - totalFees

  // This month / last month
  const now = new Date()
  const thisMonth = jobs
    .filter(j => {
      const d = new Date(j.completed_at || j.updated_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((s, j) => s + (j.inspection_charges || 0) + (j.work_cost || 0) - (j.platform_fee || 0), 0)
  const lastMonth = jobs
    .filter(j => {
      const d = new Date(j.completed_at || j.updated_at)
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear()
    })
    .reduce((s, j) => s + (j.inspection_charges || 0) + (j.work_cost || 0) - (j.platform_fee || 0), 0)

  // Weekly bar chart — last 7 days mapped to Mon–Sun slots
  const weeklyData = DAYS.map((day, i) => {
    const dayDate = new Date()
    const currentDay = (dayDate.getDay() + 6) % 7 // Monday=0
    const diff = i - currentDay
    const target = new Date(dayDate)
    target.setDate(target.getDate() + diff)
    const amount = jobs
      .filter(j => {
        const d = new Date(j.completed_at || j.updated_at)
        return d.toDateString() === target.toDateString()
      })
      .reduce((s, j) => s + (j.inspection_charges || 0) + (j.work_cost || 0) - (j.platform_fee || 0), 0)
    return { day, amount }
  })
  const maxAmount = Math.max(...weeklyData.map(d => d.amount), 1)
  const weeklyTotal = weeklyData.reduce((s, d) => s + d.amount, 0)

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Green header */}
      <div className="bg-primary px-6 pt-10 pb-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => nav('/worker/dashboard')}><IoArrowBack size={24} className="text-white" /></button>
          <h1 className="text-white text-xl font-medium">Earnings History</h1>
        </div>
      </div>

      {/* Total earnings hero card */}
      <div className="mx-5 mt-5 bg-primary rounded-2xl p-5 shadow-md">
        <p className="text-white/80 text-sm mb-2">Total Earnings</p>
        <p className="text-white text-3xl font-semibold mb-4">PKR {totalNet.toLocaleString()}</p>
        <div className="flex gap-4">
          <div className="flex-1">
            <p className="text-white/70 text-xs mb-1">This Month</p>
            <p className="text-white text-base font-medium">PKR {thisMonth.toLocaleString()}</p>
          </div>
          <div className="flex-1">
            <p className="text-white/70 text-xs mb-1">Last Month</p>
            <p className="text-white text-base font-medium">PKR {lastMonth.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        {/* Stats row */}
        <div className="flex gap-3">
          <div className="flex-1 bg-white rounded-2xl shadow-sm p-4">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center mb-3">
              <IoStar size={20} className="text-yellow-500" />
            </div>
            <p className="text-xs text-text-muted mb-1">Avg Rating</p>
            <p className="text-lg font-semibold text-text-primary">4.7</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl shadow-sm p-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-3">
              <IoTrendingUp size={20} className="text-blue-500" />
            </div>
            <p className="text-xs text-text-muted mb-1">Total Jobs</p>
            <p className="text-lg font-semibold text-text-primary">{jobs.length}</p>
          </div>
        </div>

        {/* Weekly bar chart */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-base font-semibold text-text-primary mb-4">This Week</p>
          <div className="flex items-end justify-between h-[120px] gap-1 mb-4">
            {weeklyData.map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className="w-full bg-primary/20 rounded-t-sm relative overflow-hidden"
                    style={{ height: `${Math.max((item.amount / maxAmount) * 100, 4)}%` }}
                  >
                    <div className="absolute bottom-0 w-full bg-primary rounded-t-sm" style={{ height: '100%' }} />
                  </div>
                </div>
                <span className="text-[10px] text-text-muted">{item.day}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-text-muted">
            Weekly Total: PKR {weeklyTotal.toLocaleString()}
          </p>
        </div>

        {/* Job history */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-base font-semibold text-text-primary">Job History</p>
          </div>

          {loading ? (
            <p className="text-sm text-text-muted text-center py-4">Loading...</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">No earnings yet</p>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => {
                const gross = (job.inspection_charges || 0) + (job.work_cost || 0)
                const fee = job.platform_fee || 0
                const net = gross - fee
                return (
                  <button
                    key={job.id}
                    onClick={() => nav(`/customer/receipt/${job.id}`)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{job.title}</p>
                      <p className="text-xs text-text-muted mt-0.5">{job.customer_name}</p>
                      <div className="flex gap-0.5 mt-1">
                        {[1,2,3,4,5].map(i => <span key={i} className="text-xs text-yellow-400">★</span>)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-primary">PKR {net.toLocaleString()}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {new Date(job.completed_at || job.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
