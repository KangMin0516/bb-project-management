import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Something went wrong</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{this.state.error?.message}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/' }}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Go Home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
