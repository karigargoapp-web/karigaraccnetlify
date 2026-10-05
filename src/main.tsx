import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { I18nProvider } from './lib/i18n'
import { setupNativeAuthListener } from './lib/nativeAuth'
import 'leaflet/dist/leaflet.css'
import './index.css'

const LAUNCH_KEY = 'karigargo-launched'
try {
  const path = window.location.pathname
  const keep = ['/email-confirmed', '/reset-password']
  if (!sessionStorage.getItem(LAUNCH_KEY)) {
    sessionStorage.setItem(LAUNCH_KEY, '1')
    if (path !== '/' && !keep.includes(path) && !window.location.search.includes('code=')) {
      window.history.replaceState({}, '', '/')
    }
  }
} catch {}

setupNativeAuthListener()

if (new URLSearchParams(window.location.search).has('code')) {
  void import('./pages/customer/Home')
  void import('./pages/worker/Dashboard')
  void import('./pages/auth/CompleteCustomerProfile')
  void import('./pages/auth/CompleteWorkerProfile')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <App />
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
