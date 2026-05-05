import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoChatbubble, IoCheckmarkCircle, IoTime, IoLocation, IoCash } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Job, Bid } from '../../types'

type TabKey = 'placed' | 'active' | 'completed'

export default function MyBids() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [assignedJobs, setAssignedJobs] = useState<Job[]>([])
  const [placedBids, setPlacedBids] = useState<(Bid & { job?: Job })[]>([])
  const [tab, setTab] = useState<TabKey>('placed')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('*')
        .eq('worker_id', user.id)
        .order('updated_at', { ascending: false })
      if (jobData) setAssignedJobs(jobData as Job[])

      const { data: bidData } = await supabase
        .from('bids')
        .select('*')
        .eq('worker_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (bidData && bidData.length > 0) {
        const jobIds = [...new Set(bidData.map(b => b.job_id))]
        const { data: bidJobs } = await supabase.from('jobs').select('*').in('id', jobIds)
        const jobMap: Record<string, Job> = {}
        bidJobs?.forEach(j => {
          jobMap[j.id] = j as Job
        })
        setPlacedBids(bidData.map(b => ({ ...(b as Bid), job: jobMap[b.job_id] })))
      }
      setLoading(false)
    }
    fetchData()
  }, [user])

  const activeJobs = assignedJobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled')
  const completedJobs = assignedJobs.filter(j => j.status === 'completed')

  const statusBadge = (s: string) => {
    if (s === 'bidAccepted')
      return (
        <span className="text-xs font-medium px-2 py-1 rounded-lg bg-blue-100 text-blue-700">
          Accepted
        </span>
      )
    if (s === 'inspectionDone')
      return (
        <span className="text-xs font-medium px-2 py-1 rounded-lg bg-purple-100 text-purple-700">
          Inspected
        </span>
      )
    if (s === 'workCostProposed')
      return (
        <span className="text-xs font-medium px-2 py-1 rounded-lg bg-yellow-100 text-yellow-700">
          Cost Sent
        </span>
      )
    if (s === 'workCostAccepted')
      return (
        <span className="text-xs font-medium px-2 py-1 rounded-lg bg-green-100 text-primary">
          In Progress
        </span>
      )
    return (
      <span className="text-xs font-medium px-2 py-1 rounded-lg bg-gray-100 text-text-muted">
        {s}
      </span>
    )
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'placed', label: 'Bid Placed', count: placedBids.length },
    { key: 'active', label: 'In Progress', count: activeJobs.length },
    { key: 'completed', label: 'Completed', count: completedJobs.length },
  ]

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <div className="bg-primary px-6 pt-10 pb-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={() => nav('/worker/dashboard')}>
            <IoArrowBack size={24} className="text-white" />
          </button>
          <h1 className="text-white text-xl font-medium">My Jobs</h1>
        </div>
      </div>

      <div className="flex bg-white mx-5 mt-5 rounded-xl p-1 shadow-sm">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-medium rounded-lg transition ${
              tab === t.key ? 'bg-primary text-white' : 'text-text-muted'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto pb-8">
        {loading ? (
          <p className="text-center text-sm text-text-muted py-8">Loading...</p>
        ) : tab === 'placed' ? (
          placedBids.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-sm font-medium text-text-primary">No pending bids</p>
              <p className="text-xs text-text-muted mt-1">
                Bid on available jobs to see them here
              </p>
            </div>
          ) : (
            placedBids.map(bid => (
              <div key={bid.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-text-primary">
                      {bid.job?.title || 'Job'}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">{bid.job?.customer_name}</p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-lg bg-amber-100 text-amber-700">
                    Pending
                  </span>
                </div>
                {bid.job && (
                  <div className="flex flex-wrap gap-3 text-xs text-text-muted mb-3">
                    <span className="flex items-center gap-1">
                      <IoLocation size={12} /> {bid.job.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <IoCash size={12} /> PKR {Number(bid.job.budget).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div>
                    <p className="text-xs text-text-muted">Your bid</p>
                    <p className="text-sm font-semibold text-primary">
                      PKR {bid.inspection_charges}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-text-muted">
                    <IoTime size={12} />
                    {new Date(bid.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          )
        ) : tab === 'active' ? (
          activeJobs.length === 0 ? (
            <p className="text-center text-sm text-text-muted py-8">No active jobs right now</p>
          ) : (
            activeJobs.map(job => (
              <div key={job.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-text-primary">{job.title}</p>
                      {statusBadge(job.status)}
                    </div>
                    <p className="text-xs text-text-muted">{job.customer_name}</p>
                    <p className="text-xs text-text-muted mt-0.5">{job.location}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-primary">
                      PKR{' '}
                      {((job.inspection_charges || 0) + (job.work_cost || 0)).toLocaleString()}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {new Date(job.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-border">
                  <button
                    onClick={() => nav(`/chat/${job.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 border border-border py-2.5 rounded-xl text-xs font-medium text-text-primary"
                  >
                    <IoChatbubble size={14} className="text-primary" /> Chat
                  </button>
                  <button
                    onClick={() => nav(`/worker/active-job/${job.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-white py-2.5 rounded-xl text-xs font-medium"
                  >
                    <IoCheckmarkCircle size={14} /> View Job
                  </button>
                </div>
              </div>
            ))
          )
        ) : completedJobs.length === 0 ? (
          <p className="text-center text-sm text-text-muted py-8">No completed jobs yet</p>
        ) : (
          completedJobs.map(job => (
            <div key={job.id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text-primary">{job.title}</p>
                  <p className="text-xs text-text-muted">{job.customer_name}</p>
                  <p className="text-xs text-text-muted mt-0.5">{job.location}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-primary">
                    PKR{' '}
                    {((job.inspection_charges || 0) + (job.work_cost || 0)).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {new Date(job.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-3 border-t border-border">
                <span className="flex-1 flex items-center gap-1 text-xs text-green-600 font-medium">
                  <IoCheckmarkCircle size={14} /> Completed
                </span>
                <button
                  onClick={() => nav(`/worker/job-summary/${job.id}`)}
                  className="flex items-center justify-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-xs font-medium"
                >
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
