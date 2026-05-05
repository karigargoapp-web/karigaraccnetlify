import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoNotifications } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Notification } from '../../types'

export default function Notifications() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (data) setNotifications(data as Notification[])
      setLoading(false)
    }
    fetch()

    // Mark all as read when opening
    supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
  }, [user])

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="top-bar flex items-center gap-3">
        <button onClick={() => nav('/customer/home')}>
          <IoArrowBack size={22} className="text-white" />
        </button>
        <h1 className="text-lg font-semibold text-white">Notifications</h1>
      </div>

      {/* Notifications List */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-text-muted">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <IoNotifications size={64} className="text-gray-300 mb-4" />
            <p className="text-lg font-medium text-text-primary">No notifications</p>
            <p className="text-sm text-text-muted">You have no notifications yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`bg-white rounded-xl p-4 shadow-sm ${!n.read ? 'border-l-4 border-primary' : ''}`}
              >
                <p className="text-sm font-medium text-text-primary">{n.title}</p>
                <p className="text-xs text-text-secondary mt-1">{n.body}</p>
                <p className="text-[10px] text-text-muted mt-2">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
