/** Web Notifications API helpers (Chrome, Edge, Firefox; limited on iOS Safari). */

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!isBrowserNotificationSupported()) return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export function showBrowserNotification(title: string, options?: NotificationOptions): void {
  if (!isBrowserNotificationSupported()) return
  if (Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      icon: '/favicon.png',
      ...options,
    })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    // ignore
  }
}
