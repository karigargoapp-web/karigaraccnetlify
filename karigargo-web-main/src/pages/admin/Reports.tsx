import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoCheckmarkCircle } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface Report {
  id: string
  entity_type: 'user' | 'job'
  entity_id: string
  entity_name: string
  reason: string
  flagged_by: string
  status: 'open' | 'resolved'
  notes?: string
  created_at: string
}

export default function AdminReports() {
  const nav = useNavigate()
  const [reports, setReports] = useState<Report[]>([])
  const [tab, setTab] = useState<'open' | 'resolved'>('open')
  const [notes, setNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.from('reports').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setReports(data as Report[])
    })
  }, [])

  const filtered = reports.filter(r => r.status === tab)

  const resolve = async (id: string) => {
    await supabase.from('reports').update({ status: 'resolved', notes: notes[id] || null }).eq('id', id)
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'resolved', notes: notes[id] } : r))
    toast.success('Resolved')
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="top-bar flex items-center gap-3">
        <button onClick={() => nav('/admin')}><IoArrowBack size={22} className="text-white" /></button>
        <h1 className="text-lg font-semibold text-white">Reports</h1>
      </div>

      <div className="flex bg-white border-b border-border">
        {(['open', 'resolved'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition capitalize ${tab === t ? 'text-primary border-primary' : 'text-text-muted border-transparent'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 px-5 py-4 space-y-3 overflow-y-auto">
        {filtered.length === 0 ? <p className="text-center text-sm text-text-muted py-8">No {tab} reports</p> :
          filtered.map(r => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">{r.entity_name}</p>
                  <span className="text-xs bg-surface px-2 py-0.5 rounded text-text-muted capitalize">{r.entity_type}</span>
                </div>
                {r.status === 'resolved' && <IoCheckmarkCircle className="text-primary" size={20} />}
              </div>
              <p className="text-sm text-text-secondary mt-2">{r.reason}</p>
              <p className="text-xs text-text-muted mt-1">Flagged by: {r.flagged_by} · {new Date(r.created_at).toLocaleDateString()}</p>
              {r.notes && <p className="text-xs text-primary mt-1">Notes: {r.notes}</p>}
              {r.status === 'open' && (
                <div className="mt-3 space-y-2">
                  <input placeholder="Add notes..." value={notes[r.id] || ''} onChange={e => setNotes(prev => ({ ...prev, [r.id]: e.target.value }))} className="text-sm" />
                  <button onClick={() => resolve(r.id)} className="btn-primary !py-2.5 text-sm">Resolve</button>
                </div>
              )}
            </div>
          ))
        }
      </div>
    </div>
  )
}
