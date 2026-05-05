import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoSearch, IoCheckmarkCircle, IoBan } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import type { User } from '../../types'
import toast from 'react-hot-toast'

export default function AdminUsers() {
  const nav = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [selected, setSelected] = useState<User | null>(null)

  useEffect(() => {
    supabase.from('users').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setUsers(data as User[])
    })
  }, [])

  const filtered = users.filter(u => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email?.toLowerCase().includes(search.toLowerCase())) return false
    if (roleFilter && u.role !== roleFilter) return false
    return true
  })

  const toggleVerify = async (u: User) => {
    await supabase.from('users').update({ verified: !u.verified }).eq('id', u.id)
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, verified: !x.verified } : x))
    toast.success(u.verified ? 'Unverified' : 'Verified')
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="top-bar flex items-center gap-3">
        <button onClick={() => nav('/admin')}><IoArrowBack size={22} className="text-white" /></button>
        <h1 className="text-lg font-semibold text-white">Users</h1>
      </div>

      <div className="px-5 py-4 space-y-3 bg-white border-b border-border">
        <div className="relative">
          <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="!pl-9" />
        </div>
        <div className="flex gap-2">
          {['', 'customer', 'worker', 'admin'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${roleFilter === r ? 'bg-primary text-white' : 'bg-surface text-text-secondary'}`}>
              {r || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map(u => (
          <button key={u.id} onClick={() => setSelected(u)} className="w-full px-5 py-3 flex items-center gap-3 border-b border-border text-left bg-white hover:bg-surface transition">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">{u.name[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary flex items-center gap-1">{u.name} {u.verified && <IoCheckmarkCircle size={14} className="text-primary" />}</p>
              <p className="text-xs text-text-muted">{u.role} · {u.city || '—'} · {new Date(u.created_at).toLocaleDateString()}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Side panel */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-[360px] bg-white z-50 overflow-y-auto animate-slide-up">
            <div className="top-bar flex items-center gap-3">
              <button onClick={() => setSelected(null)}><IoArrowBack size={22} className="text-white" /></button>
              <h2 className="text-lg font-semibold text-white">{selected.name}</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-secondary">Email</span><span>{selected.email}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Phone</span><span>{selected.phone || '—'}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Role</span><span className="capitalize">{selected.role}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">City</span><span>{selected.city || '—'}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Joined</span><span>{new Date(selected.created_at).toLocaleDateString()}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Verified</span>
                  <span className={selected.verified ? 'text-primary font-medium' : 'text-danger'}>{selected.verified ? 'Yes' : 'No'}</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => toggleVerify(selected)} className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${selected.verified ? 'btn-ghost' : 'bg-primary text-white'}`}>
                  {selected.verified ? 'Unverify' : 'Verify Worker'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
