import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { I18nProvider } from './lib/i18n'
import { setupNativeAuthListener } from './lib/nativeAuth'
import 'leaflet/dist/leaflet.css'
import './index.css'

// Register deep link listener BEFORE React mounts — ensures no events are missed
setupNativeAuthListener()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <App />
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
