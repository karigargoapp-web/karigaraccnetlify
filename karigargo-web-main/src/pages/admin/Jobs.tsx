import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import type { Job } from '../../types'

export default function AdminJobs() {
  const nav = useNavigate()
  const [jobs, setJobs] = useState<Job[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Job | null>(null)

  useEffect(() => {
    supabase.from('jobs').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setJobs(data as Job[])
    })
  }, [])

  const filtered = statusFilter ? jobs.filter(j => j.status === statusFilter) : jobs
  const statuses = ['', 'pending', 'bidAccepted', 'inspectionDone', 'workCostProposed', 'workCostAccepted', 'completed', 'cancelled']

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="top-bar flex items-center gap-3">
        <button onClick={() => nav('/admin')}><IoArrowBack size={22} className="text-white" /></button>
        <h1 className="text-lg font-semibold text-white">All Jobs</h1>
      </div>

      <div className="px-5 py-3 bg-white border-b border-border">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="!py-2 text-sm">
          {statuses.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map(j => (
          <button key={j.id} onClick={() => setSelected(j)} className="w-full px-5 py-3 border-b border-border text-left bg-white hover:bg-surface">
            <div className="flex justify-between items-start">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{j.title}</p>
                <p className="text-xs text-text-muted">{j.customer_name} → {j.worker_name || '—'} · {j.category}</p>
              </div>
              <span className={j.status === 'completed' ? 'pill-completed' : j.status === 'pending' ? 'pill-pending' : j.status === 'cancelled' ? 'pill-rejected' : 'pill-active'}>{j.status}</span>
            </div>
            <p className="text-xs text-text-muted mt-1">₨{j.budget} · {new Date(j.created_at).toLocaleDateString()}</p>
          </button>
        ))}
      </div>

      {selected && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-[360px] bg-white z-50 overflow-y-auto animate-slide-up">
            <div className="top-bar flex items-center gap-3">
              <button onClick={() => setSelected(null)}><IoArrowBack size={22} className="text-white" /></button>
              <h2 className="text-lg font-semibold text-white truncate">{selected.title}</h2>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-text-secondary">Status</span><span className="capitalize font-medium">{selected.status}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Category</span><span>{selected.category}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Customer</span><span>{selected.customer_name}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Worker</span><span>{selected.worker_name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Budget</span><span>₨{selected.budget}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Location</span><span>{selected.location}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Date</span><span>{selected.date || '—'}</span></div>
              {selected.inspection_charges != null && <div className="flex justify-between"><span className="text-text-secondary">Inspection</span><span>₨{selected.inspection_charges}</span></div>}
              {selected.work_cost != null && <div className="flex justify-between"><span className="text-text-secondary">Work Cost</span><span>₨{selected.work_cost}</span></div>}
              {selected.platform_fee != null && <div className="flex justify-between"><span className="text-text-secondary">Platform Fee</span><span>₨{selected.platform_fee}</span></div>}
              <p className="text-xs text-text-secondary mt-2">{selected.description}</p>
              <button onClick={async () => {
                await supabase.from('jobs').update({ status: 'cancelled' }).eq('id', selected.id)
                setJobs(prev => prev.map(j => j.id === selected.id ? { ...j, status: 'cancelled' as any } : j))
                setSelected(null)
              }} className="btn-danger mt-4">Cancel Job</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
