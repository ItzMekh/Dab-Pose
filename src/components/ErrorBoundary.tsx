'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV === 'development') {
      console.error('[DabPose]', error, info.componentStack)
    }
  }

  reset = (): void => this.setState({ error: null })

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="text-red-400 text-lg font-semibold">Something went wrong</p>
          <p className="text-gray-500 text-sm font-mono">{this.state.error.message}</p>
          <button
            onClick={this.reset}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
