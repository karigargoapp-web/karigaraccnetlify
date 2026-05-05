import { useState, useEffect, useRef } from 'react'
import { IoNotifications, IoNotificationsOff } from 'react-icons/io5'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getBrowserNotificationPermission, showBrowserNotification } from '../lib/browserNotifications'
import toast from 'react-hot-toast'
import type { Notification } from '../types'

const STORAGE_KEY = 'karigargo_notif_popup_enabled'

function getStoredPref(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === null ? true : v === 'true'
  } catch {
    return true
  }
}

export default function NotificationBell({ showBadgeOnly = false }: { showBadgeOnly?: boolean }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [popupEnabled, setPopupEnabled] = useState<boolean>(getStoredPref)
  const popupEnabledRef = useRef(popupEnabled)
  const unread = notifications.filter(n => !n.read).length

  // Keep ref in sync so the realtime callback always reads latest value
  useEffect(() => {
    popupEnabledRef.current = popupEnabled
    try { localStorage.setItem(STORAGE_KEY, String(popupEnabled)) } catch { /* ignore */ }
  }, [popupEnabled])

  useEffect(() => {
    if (!user) return
    const fetchNotifs = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setNotifications(data as Notification[])
    }
    fetchNotifs()

    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as Notification
          setNotifications(prev => [row, ...prev].slice(0, 20))

          if (!popupEnabledRef.current) return

          // In-app toast popup when page is visible
          if (document.visibilityState === 'visible') {
            toast.custom(
              (t) => (
                <div
                  className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-xs w-full bg-white shadow-lg rounded-xl pointer-events-auto flex overflow-hidden border border-gray-100`}
                >
                  <div className="flex-1 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <IoNotifications className="text-primary" size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{row.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{row.body}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="px-3 text-xs font-medium text-primary border-l border-gray-100 hover:bg-gray-50"
                  >
                    ✕
                  </button>
                </div>
              ),
              { duration: 5000, position: 'top-right' }
            )
          }

          // Browser notification when page is hidden
          if (document.visibilityState === 'hidden' && getBrowserNotificationPermission() === 'granted') {
            showBrowserNotification(row.title, { body: row.body, tag: row.id })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const markAllRead = async () => {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const handleBellClick = () => {
    if (!open) markAllRead()
    setOpen(prev => !prev)
  }

  const togglePopup = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPopupEnabled(prev => !prev)
  }

  // Badge-only mode for Messages button
  if (showBadgeOnly) {
    return unread > 0 ? (
      <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center z-10">
        {unread > 9 ? '9+' : unread}
      </span>
    ) : null
  }

  // Full notification bell for top bar
  return (
    <div className="relative">
      <button onClick={handleBellClick} className="relative p-1">
        <IoNotifications size={20} className="text-white" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 w-72 bg-white rounded-card shadow-lg border border-border z-50 animate-fade-in overflow-hidden">
            {/* Header with toggle */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">Notifications</p>
              <button
                onClick={togglePopup}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition ${
                  popupEnabled
                    ? 'bg-primary/10 text-primary'
                    : 'bg-gray-100 text-gray-500'
                }`}
                title={popupEnabled ? 'Popups ON — tap to turn off' : 'Popups OFF — tap to turn on'}
              >
                {popupEnabled
                  ? <><IoNotifications size={12} /> On</>
                  : <><IoNotificationsOff size={12} /> Off</>
                }
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-6">No notifications yet</p>
              ) : notifications.map(n => (
                <div key={n.id} className={`px-4 py-3 border-b border-border last:border-0 ${!n.read ? 'bg-primary/5' : ''}`}>
                  <p className="text-sm text-text-primary font-medium">{n.title}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-text-muted mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
