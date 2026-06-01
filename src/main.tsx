import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { I18nProvider } from './lib/i18n'
import { setupNativeAuthListener } from './lib/nativeAuth'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './lib/supabase'
import 'leaflet/dist/leaflet.css'
import './index.css'

setupNativeAuthListener()

const SESSION_KEY = 'sb-epekjmfmbgwfonjyhklm-auth-token'
const VERIFIER_KEY = 'sb-epekjmfmbgwfonjyhklm-auth-token-code-verifier'

async function boot() {
  // If OAuth callback — exchange code BEFORE React mounts
  const code = new URLSearchParams(window.location.search).get('code')
  if (code) {
    const raw = localStorage.getItem(VERIFIER_KEY) || localStorage.getItem('karigargo-pkce-backup') || ''
    const verifier = raw.split('/')[0]
    localStorage.removeItem(VERIFIER_KEY)
    localStorage.removeItem('karigargo-pkce-backup')

    if (verifier) {
      try {
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
          body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
        })
        const data = await resp.json()
        if (data.access_token && data.refresh_token) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(data))
          // Redirect to clean URL — on reload session is in localStorage
          window.location.replace(window.location.pathname)
          return // Do NOT mount React — let the reload handle it
        }
      } catch {}
    }
    // Exchange failed — still clean the URL and let React mount normally
    window.history.replaceState({}, '', window.location.pathname)
  }

  // Normal mount
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <I18nProvider>
          <App />
        </I18nProvider>
      </BrowserRouter>
    </React.StrictMode>,
  )
}

boot()
