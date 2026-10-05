import { Toaster } from 'react-hot-toast'
import { AppRouter } from './router'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { fontSize: '14px', borderRadius: '12px' },
          success: { iconTheme: { primary: '#006600', secondary: '#fff' } },
        }}
      />
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
    </>
  )
}
