import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoDownload } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import type { Job } from '../../types'

export default function AdminRevenue() {
  const nav = useNavigate()
  const [jobs, setJobs] = useState<Job[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    let q = supabase.from('jobs').select('*').eq('status', 'completed').order('completed_at', { ascending: false })
    if (from) q = q.gte('completed_at', from)
    if (to) q = q.lte('completed_at', to + 'T23:59:59Z')
    q.then(({ data }) => { if (data) setJobs(data as Job[]) })
  }, [from, to])

  const totalGross = jobs.reduce((s, j) => s + (j.inspection_charges || 0) + (j.work_cost || 0), 0)
  const totalFees = jobs.reduce((s, j) => s + (j.platform_fee || 0), 0)
  const totalNet = totalGross - totalFees

  const exportCSV = () => {
    const header = 'Job,Customer,Worker,Inspection,WorkCost,PlatformFee,Total,Date\n'
    const rows = jobs.map(j => {
      const total = (j.inspection_charges || 0) + (j.work_cost || 0) + (j.platform_fee || 0)
      return `"${j.title}","${j.customer_name}","${j.worker_name}",${j.inspection_charges || 0},${j.work_cost || 0},${j.platform_fee || 0},${total},${j.completed_at || j.updated_at}`
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'revenue.csv'; a.click()
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="top-bar flex items-center gap-3">
        <button onClick={() => nav('/admin')}><IoArrowBack size={22} className="text-white" /></button>
        <h1 className="text-lg font-semibold text-white">Revenue</h1>
      </div>

      <div className="px-5 py-4 bg-white border-b border-border space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-text-muted">From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="text-xs text-text-muted">To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="card p-3"><p className="text-[10px] text-text-muted">Gross</p><p className="text-sm font-bold">₨{totalGross}</p></div>
          <div className="card p-3"><p className="text-[10px] text-text-muted">Fees</p><p className="text-sm font-bold text-primary">₨{totalFees}</p></div>
          <div className="card p-3"><p className="text-[10px] text-text-muted">To Workers</p><p className="text-sm font-bold">₨{totalNet}</p></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex justify-between items-center mb-3">
          <p className="section-title !mb-0">Receipts ({jobs.length})</p>
          <button onClick={exportCSV} className="flex items-center gap-1 text-xs text-primary font-medium"><IoDownload /> Export CSV</button>
        </div>
        {jobs.map(j => {
          const total = (j.inspection_charges || 0) + (j.work_cost || 0) + (j.platform_fee || 0)
          return (
            <div key={j.id} className="card p-3 mb-2 text-sm">
              <div className="flex justify-between"><span className="font-medium text-text-primary truncate flex-1">{j.title}</span><span className="font-semibold text-primary ml-2">₨{total}</span></div>
              <p className="text-xs text-text-muted mt-1">{j.customer_name} → {j.worker_name} · Fee: ₨{j.platform_fee || 0}</p>
              <p className="text-[10px] text-text-muted">{new Date(j.completed_at || j.updated_at).toLocaleDateString()}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
