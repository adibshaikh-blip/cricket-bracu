import type { ReactNode } from 'react'
import { Component } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 24, textAlign: 'left' }}>
          <h1 style={{ marginTop: 0 }}>Something went wrong</h1>
          <p style={{ color: '#b42318' }}>{this.state.error.message}</p>
          <p style={{ color: 'var(--text)' }}>
            Open the browser console for more details.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

