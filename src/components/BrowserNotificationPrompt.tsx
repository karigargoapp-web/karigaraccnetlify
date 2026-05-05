import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  getBrowserNotificationPermission,
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
} from '../lib/browserNotifications'
import toast from 'react-hot-toast'

const SESSION_DISMISS_KEY = 'karigargo_notif_prompt_dismissed'

export default function BrowserNotificationPrompt() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(() =>
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_DISMISS_KEY) === '1' : false,
  )
  const [permission, setPermission] = useState(getBrowserNotificationPermission)

  useEffect(() => {
    setPermission(getBrowserNotificationPermission())
  }, [user])

  if (!user || dismissed) return null
  if (!isBrowserNotificationSupported()) return null
  if (permission !== 'default') return null

  const onEnable = async () => {
    const p = await requestBrowserNotificationPermission()
    setPermission(p)
    if (p === 'granted') toast.success('Browser notifications enabled')
    if (p === 'denied') toast.error('Notifications blocked — enable them in your browser settings if you change your mind.')
  }

  const onDismiss = () => {
    sessionStorage.setItem(SESSION_DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div
      className="fixed bottom-0 left-1/2 z-[100] w-full max-w-[430px] -translate-x-1/2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
      role="region"
      aria-label="Browser notifications"
    >
      <div className="pointer-events-auto rounded-2xl border border-border bg-white p-4 shadow-lg">
        <p className="text-sm font-medium text-text-primary">Get notified in this browser</p>
        <p className="text-xs text-text-secondary mt-1">
          Allow notifications so you don’t miss bids, messages, and job updates when the tab is in the background.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={onEnable}
            className="flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-white active:scale-[0.98] transition"
          >
            Enable
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-text-secondary active:scale-[0.98] transition"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
