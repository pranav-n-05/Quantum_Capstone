/**
 * Session state.
 *
 * The password is sent once and never stored client-side: the server answers
 * with an HttpOnly cookie, which JavaScript cannot read, so there is nothing
 * here for a script on the page to steal. That is also why `authenticated`
 * comes from asking the server rather than from anything we keep locally.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export function useAuth() {
  // null means "we have not heard back yet" -- distinct from "not signed in",
  // so the app can hold the paint instead of flashing a login screen at
  // someone who already has a valid session.
  const [status, setStatus] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const activeRef = useRef(true)

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/status')
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      if (activeRef.current) setStatus(payload)
    } catch {
      // If we cannot reach the auth endpoint the API is down, which the
      // dashboard's own error screen already explains better than we could.
      if (activeRef.current) setStatus({ enabled: false, authenticated: true })
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (password) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!response.ok) {
        const detail = await response
          .json()
          .then((body) => body.detail)
          .catch(() => null)
        throw new Error(typeof detail === 'string' ? detail : `HTTP ${response.status}`)
      }
      const payload = await response.json()
      if (activeRef.current) setStatus(payload)
      return true
    } catch (caught) {
      if (activeRef.current) setError(caught.message)
      return false
    } finally {
      if (activeRef.current) setIsSubmitting(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      if (activeRef.current) setStatus({ enabled: true, authenticated: false })
    }
  }, [])

  return {
    status,
    isReady: status !== null,
    // Treated as signed in whenever auth is switched off entirely.
    isAuthenticated: status?.authenticated ?? false,
    authEnabled: status?.enabled ?? false,
    isSubmitting,
    error,
    login,
    logout,
    refresh,
  }
}
