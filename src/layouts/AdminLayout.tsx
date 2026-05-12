import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { IoGrid, IoPeople, IoBriefcase, IoWarning, IoWallet, IoTrendingUp, IoFlag, IoMenu, IoClose, IoLogOut, IoShieldCheckmark } from 'react-icons/io5'

const NAV = [
  { to:'/admin', label:'Dashboard', icon:IoGrid, end:true },
  { to:'/admin/workers', label:'Workers', icon:IoShieldCheckmark },
  { to:'/admin/users', label:'Customers', icon:IoPeople },
  { to:'/admin/jobs', label:'Jobs', icon:IoBriefcase },
  { to:'/admin/disputes', label:'Disputes', icon:IoWarning },
  { to:'/admin/wallets', label:'Wallets', icon:IoWallet },
  { to:'/admin/revenue', label:'Revenue', icon:IoTrendingUp },
  { to:'/admin/reports', label:'Reports', icon:IoFlag },
]

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function SidebarContent() {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <IoShieldCheckmark className="text-white text-base" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">KarigarGo</p>
              <p className="text-xs text-gray-400">Admin Panel</p>
            </div>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1 rounded-lg hover:bg-gray-100">
            <IoClose className="text-gray-500 text-xl" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }>
              <item.icon className="text-lg flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <div className="px-3 py-2.5 mb-1 bg-gray-50 rounded-xl">
            <p className="text-xs font-semibold text-gray-900 truncate">{user?.name || 'Admin'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors mt-1">
            <IoLogOut className="text-lg" /> Sign Out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden lg:flex lg:flex-col w-56 fixed inset-y-0 left-0 z-30 border-r border-gray-100 shadow-sm">
        <SidebarContent />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-56 flex flex-col z-50 shadow-2xl">
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
        <header className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20 shadow-sm">
          <button onClick={() => setOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <IoMenu className="text-xl text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <IoShieldCheckmark className="text-white text-xs" />
            </div>
            <p className="font-bold text-gray-900 text-sm">KarigarGo Admin</p>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
