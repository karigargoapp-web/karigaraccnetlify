import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  IoGrid, IoPeople, IoBriefcase, IoWarning, IoWallet,
  IoTrendingUp, IoFlag, IoMenu, IoLogOut, IoShieldCheckmark,
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

export default function AdminLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <IoShieldCheckmark className="text-white text-base" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">KarigarGo</p>
            <p className="text-xs text-gray-500">Admin Panel</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`
            }>
            <item.icon className="text-lg flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
          <p className="text-xs text-gray-400">{user?.email}</p>
        </div>
        <button onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
          <IoLogOut className="text-lg" />Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden lg:flex lg:flex-col w-60 bg-white border-r border-gray-100 fixed inset-y-0 left-0 z-30">
        <Sidebar />
      </aside>
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-60 bg-white flex flex-col z-50"><Sidebar /></div>
        </div>
      )}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        <header className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <IoMenu className="text-xl text-gray-700" />
          </button>
          <p className="font-bold text-gray-900">KarigarGo Admin</p>
        </header>
        <main className="flex-1 px-4 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
