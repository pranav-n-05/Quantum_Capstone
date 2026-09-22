/**
 * Bring-your-own-key state.
 *
 * The secret only ever travels one way. It goes up in a POST body and is never
 * returned: reads come back with a masked hint like "••••3f9a", which is enough
 * to confirm which key is loaded and worthless to anyone who intercepts it.
 * Nothing here writes the key to localStorage either -- a key cached in the
 * browser outlives the session that needed it.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

async function describeFailure(response) {
  try {
    const { detail } = await response.json()
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((d) => d?.msg?.replace(/^Value error,\s*/, '') ?? '').join('; ')
    }
  } catch {
    /* fall through to the status code */
  }
  return `HTTP ${response.status}`
}

export function useCredentials() {
  const [status, setStatus] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
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
      const response = await fetch('/api/credentials')
      if (!response.ok) return
      const payload = await response.json()
      if (activeRef.current) setStatus(payload)
    } catch {
      // The card is an enhancement; if this fails the dashboard is unaffected.
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const save = useCallback(async ({ apiKey, crn, apiUrl }) => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey.trim(),
          crn: crn.trim(),
          ...(apiUrl?.trim() ? { api_url: apiUrl.trim() } : {}),
        }),
      })
      if (!response.ok) throw new Error(await describeFailure(response))
      const payload = await response.json()
      if (activeRef.current) setStatus(payload)
      return true
    } catch (caught) {
      if (activeRef.current) setError(caught.message)
      return false
    } finally {
      if (activeRef.current) setIsSaving(false)
    }
  }, [])

  const clear = useCallback(async () => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/credentials/clear', { method: 'POST' })
      if (!response.ok) throw new Error(await describeFailure(response))
      const payload = await response.json()
      if (activeRef.current) setStatus(payload)
      return true
    } catch (caught) {
      if (activeRef.current) setError(caught.message)
      return false
    } finally {
      if (activeRef.current) setIsSaving(false)
    }
  }, [])

  return { status, isSaving, error, save, clear, refresh }
}
