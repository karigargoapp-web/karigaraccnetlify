import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoBriefcase, IoLocation, IoCash, IoPricetag, IoTrash } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Job, Bid } from '../../types'
import toast from 'react-hot-toast'

type TabKey = 'active' | 'completed' | 'cancelled'

export default function MyJobs() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [bids, setBids] = useState<Record<string, Bid[]>>({})
  const [tab, setTab] = useState<TabKey>('active')
  const [loading, setLoading] = useState(true)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [deleteConfirmJob, setDeleteConfirmJob] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user) return
    const fetchData = async () => {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
      if (jobData) {
        setJobs(jobData as Job[])
        // fetch bids for each job
        const bidMap: Record<string, Bid[]> = {}
        await Promise.all(
          (jobData as Job[]).map(async (j) => {
            const { data: bData } = await supabase.from('bids').select('*').eq('job_id', j.id)
            bidMap[j.id] = (bData as Bid[]) || []
          })
        )
        setBids(bidMap)
      }
      setLoading(false)
    }
    fetchData()
  }, [user])

  const cancelJob = async (jobId: string) => {
    setDeleting(true)
    const { error } = await supabase
      .from('jobs')
      .update({ status: 'cancelled' })
      .eq('id', jobId)
    setDeleting(false)
    setDeleteConfirmJob(null)
    if (error) {
      toast.error('Failed to cancel job: ' + error.message)
      return
    }
    toast.success('Job cancelled')
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'cancelled' } : j))
  }

  const canCancelJob = (job: Job) => {
    return job.status === 'pending' || job.status === 'bidAccepted'
  }

  const filtered = jobs.filter(j => {
    if (tab === 'active') return j.status !== 'completed' && j.status !== 'cancelled'
    if (tab === 'completed') return j.status === 'completed'
    return j.status === 'cancelled'
  })

  const totalBids = jobs.reduce((s, j) => s + (bids[j.id]?.length || 0), 0)
  const activeCount = jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled').length

  const statusBadge = (s: string) => {
    if (s === 'pending') return <span className="pill-pending text-[10px] font-medium">Bidding</span>
    if (s === 'completed') return <span className="pill-completed text-[10px] font-medium">Done</span>
    if (s === 'cancelled') return <span className="pill-rejected text-[10px] font-medium">Cancelled</span>
    return <span className="pill-active text-[10px] font-medium">In Progress</span>
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Green header */}
      <div className="bg-primary px-6 pt-10 pb-6 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => nav('/customer/home')}>
            <IoArrowBack size={24} className="text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-medium">My Jobs</h1>
            <p className="text-white/70 text-sm mt-0.5">{jobs.length} jobs posted</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3">
          <div className="flex-1 bg-white/10 rounded-xl p-3">
            <p className="text-white/70 text-xs mb-1">Total Jobs</p>
            <p className="text-white text-lg font-semibold">{jobs.length}</p>
          </div>
          <div className="flex-1 bg-white/10 rounded-xl p-3">
            <p className="text-white/70 text-xs mb-1">Total Bids</p>
            <p className="text-white text-lg font-semibold">{totalBids}</p>
          </div>
          <div className="flex-1 bg-white/10 rounded-xl p-3">
            <p className="text-white/70 text-xs mb-1">In Progress</p>
            <p className="text-white text-lg font-semibold">{activeCount}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white mx-5 mt-5 rounded-xl p-1 shadow-sm">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition ${tab === t.key ? 'bg-primary text-white' : 'text-text-muted'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto pb-8">
        {loading ? (
          <p className="text-center text-sm text-text-muted py-8">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8">
            <IoBriefcase size={64} className="text-gray-300 mb-4" />
            <p className="text-lg font-medium text-text-primary mb-2">
              {tab === 'completed' ? 'No jobs completed yet' : tab === 'cancelled' ? 'No jobs cancelled' : 'No jobs found'}
            </p>
            <p className="text-sm text-text-muted text-center mb-6">
              {tab === 'completed' ? 'Complete a job to see it here' : tab === 'cancelled' ? 'Jobs you cancel will appear here' : 'Post a Job to see it here'}
            </p>
            {tab !== 'completed' && tab !== 'cancelled' && (
              <button onClick={() => nav('/customer/post-job')} className="btn-primary px-6">Post a Job</button>
            )}
          </div>
        ) : (
          filtered.map(job => {
            const jobBids = bids[job.id] || []
            const isExpanded = expandedJob === job.id
            return (
              <div key={job.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Job header — tap to expand */}
                <button
                  className="w-full flex items-start gap-3 p-4 text-left"
                  onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <p className="text-base font-medium text-text-primary flex-1">{job.title}</p>
                      {statusBadge(job.status)}
                    </div>
                    {job.description && (
                      <p className="text-sm text-text-secondary mb-2 line-clamp-2">{job.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3">
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <IoLocation size={13} /> {job.location}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <IoCash size={13} /> PKR {Number(job.budget).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-primary">
                        <IoPricetag size={13} /> {jobBids.length} {jobBids.length === 1 ? 'bid' : 'bids'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {/* Delete button - always visible for jobs that can be deleted */}
                    {canCancelJob(job) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirmJob(job.id)
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Cancel Job"
                      >
                        <IoTrash size={18} />
                      </button>
                    )}
                  </div>
                </button>

                {/* Expanded bids section */}
                {isExpanded && (
                  <div className="border-t border-border bg-gray-50 px-4 pb-4 pt-3">
                    {jobBids.length === 0 ? (
                      <p className="text-sm text-text-muted text-center py-4">No bids yet — check back soon</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium text-text-primary">Bids Received</p>
                          <button onClick={() => nav(`/customer/job/${job.id}`)} className="text-xs text-primary font-medium">View All</button>
                        </div>
                        <div className="space-y-3">
                          {jobBids.slice(0, 3).map(bid => (
                            <div key={bid.id} className="bg-white rounded-xl border border-border p-3">
                              <div className="flex items-start gap-3 mb-2">
                                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <span className="text-base font-bold text-primary">{bid.worker_name?.[0] || 'W'}</span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-medium text-text-primary">{bid.worker_name}</p>
                                    {bid.verified && (
                                      <span className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                        <span className="text-white text-[9px] font-bold">✓</span>
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-text-muted mt-0.5">⭐ {bid.rating?.toFixed(1) || '0.0'}</p>
                                </div>
                                <p className="text-primary font-semibold text-sm">PKR {Number(bid.inspection_charges).toLocaleString()}</p>
                              </div>
                              {bid.message && (
                                <p className="text-xs text-text-secondary bg-gray-50 rounded-lg px-3 py-2 mb-2">{bid.message}</p>
                              )}
                              <div className="flex gap-2">
                                {job.status === 'pending' ? (
                                  <>
                                    <button
                                      onClick={() => nav(`/customer/job/${job.id}`)}
                                      className="flex-1 py-2 border border-border text-xs font-medium text-text-primary rounded-xl"
                                    >
                                      View Profile
                                    </button>
                                    <button
                                      onClick={() => nav(`/customer/job/${job.id}`)}
                                      className="flex-1 py-2 bg-primary text-white text-xs font-medium rounded-xl"
                                    >
                                      Accept Bid
                                    </button>
                                  </>
                                ) : job.status === 'completed' ? (
                                  <button
                                    onClick={() => nav(`/customer/job-summary/${job.id}`)}
                                    className="w-full py-2 bg-primary text-white text-xs font-medium rounded-xl"
                                  >
                                    View Summary
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => nav(`/customer/job/${job.id}`)}
                                    className="w-full py-2 border border-border text-xs font-medium text-text-primary rounded-xl"
                                  >
                                    View Details
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                          {jobBids.length > 3 && (
                            <button
                              onClick={() => nav(`/customer/job/${job.id}`)}
                              className="w-full py-3 text-xs font-medium text-primary border-t border-border"
                            >
                              View {jobBids.length - 3} more {jobBids.length - 3 === 1 ? 'bid' : 'bids'}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <IoTrash size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary text-center mb-2">Cancel Job?</h3>
            <p className="text-sm text-text-secondary text-center mb-6">
              This will cancel your job posting. It will appear in your Cancelled jobs.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmJob(null)}
                className="flex-1 py-3 border border-border rounded-xl text-sm font-medium text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={() => cancelJob(deleteConfirmJob)}
                disabled={deleting}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
              >
                {deleting ? 'Cancelling...' : 'Cancel Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
