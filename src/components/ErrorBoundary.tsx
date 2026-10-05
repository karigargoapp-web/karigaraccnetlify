import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { failed: boolean }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <img src="/logo.png" alt="KarigarGo" className="w-16 h-16 rounded-2xl mb-4" />
        <p className="text-lg font-semibold text-text-primary mb-1">Something went wrong</p>
        <p className="text-sm text-text-muted mb-6">Please reload the app to continue.</p>
        <button
          onClick={() => { window.location.href = '/' }}
          className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-medium"
        >
          Reload
        </button>
      </div>
    )
  }
}
