import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { I18nProvider } from './lib/i18n'
import { setupNativeAuthListener } from './lib/nativeAuth'
import 'leaflet/dist/leaflet.css'
import './index.css'

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
