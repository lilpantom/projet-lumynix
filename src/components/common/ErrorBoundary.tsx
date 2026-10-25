import { Component, type ReactNode } from 'react'

interface Props {
  fallback: (reset: () => void) => ReactNode
  children: ReactNode
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error('[orbitflow] view error', error)
  }
  render() {
    return this.state.error ? this.props.fallback(() => this.setState({ error: null })) : this.props.children
  }
}
