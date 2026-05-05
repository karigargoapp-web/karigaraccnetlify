import { Toaster } from 'react-hot-toast'
import { AppRouter } from './router'

export default function App() {
  return (
    <div className="app-shell">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { fontSize: '14px', borderRadius: '12px' },
          success: { iconTheme: { primary: '#006600', secondary: '#fff' } },
        }}
      />
      <AppRouter />
    </div>
  )
}
