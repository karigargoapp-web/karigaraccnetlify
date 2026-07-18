import { useState, useEffect, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import {
  IoGrid, IoPeople, IoBriefcase, IoWarning, IoWallet,
  IoTrendingUp, IoFlag, IoMenu, IoClose, IoLogOut,
  IoShieldCheckmark, IoChevronForward
} from 'react-icons/io5'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: IoGrid, end: true },
  { to: '/admin/workers', label: 'Workers', icon: IoShieldCheckmark },
  { to: '/admin/users', label: 'Customers', icon: IoPeople },
  { to: '/admin/jobs', label: 'Jobs', icon: IoBriefcase },
  { to: '/admin/disputes', label: 'Disputes', icon: IoWarning },
  { to: '/admin/wallets', label: 'Wallets', icon: IoWallet },
  { to: '/admin/revenue', label: 'Revenue', icon: IoTrendingUp },
  { to: '/admin/reports', label: 'Reports', icon: IoFlag },
]

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [openDisputes, setOpenDisputes] = useState(0)

  const fetchOpenDisputes = useCallback(async () => {
    const { count } = await supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open')
    setOpenDisputes(count || 0)
  }, [])

  useEffect(() => {
    fetchOpenDisputes()
    const channel = supabase.channel('admin-sidebar-disputes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes' }, fetchOpenDisputes)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchOpenDisputes])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0f172a' }}>
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <IoShieldCheckmark className="text-white text-lg" />
            </div>
            <div>
              <p className="font-bold text-white text-base leading-tight">KarigarGo</p>
              <p className="text-xs text-slate-400">Admin Panel</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
              <IoClose size={18} />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-3">Main Menu</p>
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/30'
                  : 'text-slate-400 hover:bg-white/8 hover:text-white'
              }`
            }>
            <item.icon className="text-lg flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.to === '/admin/disputes' && openDisputes > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shrink-0">
                {openDisputes}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-primary-light">{user?.name?.[0]?.toUpperCase() || 'A'}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{user?.name || 'Admin'}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">
          <IoLogOut className="text-lg" /> Sign Out
        </button>
      </div>
    </div>
  )
}

function Breadcrumb() {
  const location = useLocation()
  const parts = location.pathname.split('/').filter(Boolean)
  const labels: Record<string, string> = {
    admin: 'Admin', workers: 'Workers', users: 'Customers', jobs: 'Jobs',
    disputes: 'Disputes', wallets: 'Wallets', revenue: 'Revenue', reports: 'Reports',
  }
  return (
    <div className="flex items-center gap-1.5 text-sm text-slate-500">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <IoChevronForward size={12} />}
          <span className={i === parts.length - 1 ? 'text-slate-800 font-medium' : ''}>
            {labels[part] || part}
          </span>
        </span>
      ))}
    </div>
  )
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen flex" style={{ background: '#f1f5f9' }}>
      <aside className="hidden lg:flex lg:flex-col w-60 fixed inset-y-0 left-0 z-30 shadow-xl">
        <Sidebar />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-60 flex flex-col z-50">
            <Sidebar onClose={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
              <IoMenu className="text-xl text-gray-700" />
            </button>
            <Breadcrumb />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>

        <footer className="px-8 py-4 border-t border-slate-200 bg-white">
          <p className="text-xs text-slate-400">KarigarGo Admin Panel · All rights reserved</p>
        </footer>
      </div>
    </div>
  )
}
