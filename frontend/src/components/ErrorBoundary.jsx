import { Component } from 'react'

/**
 * Renders `fallback` instead of letting a render error unmount the whole app.
 *
 * React has no hook equivalent, hence the class. `resetKey` clears the error
 * when it changes, so moving to a different view gets a fresh attempt.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const { fallback } = this.props
    return typeof fallback === 'function' ? fallback(error) : fallback
  }
}
