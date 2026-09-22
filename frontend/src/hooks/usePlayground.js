/**
 * Running playground circuits.
 *
 * The app's first mutation. Everything else here reads a cache that is always
 * populated, so this is also the first place a request can be *pending* or
 * *rejected* in a way the user caused and can fix -- which is why the error
 * string is surfaced verbatim rather than flattened to "something went wrong".
 *
 * There is no fetch wrapper in this project, so this follows the conventions
 * useQuantumTelemetry already set: raw fetch, relative URLs, and an `activeRef`
 * guard before every setState that follows an await (React 18 StrictMode
 * mounts each effect twice).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** Pull a readable message out of FastAPI's 422 envelope. */
async function describeFailure(response) {
  let detail
  try {
    detail = (await response.json()).detail
  } catch {
    return `HTTP ${response.status}`
  }

  if (typeof detail === 'string') return detail

  // Pydantic returns a list of {loc, msg, type}. The message carries the
  // circuit-level explanation our model validator raised; the rest is noise.
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => item?.msg?.replace(/^Value error,\s*/, '') ?? 'Invalid circuit')
      .join('; ')
  }
  return `HTTP ${response.status}`
}

export function usePlayground() {
  const [result, setResult] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState(null)
  const activeRef = useRef(true)

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  const run = useCallback(async (circuit, mode = 'noisy') => {
    setIsRunning(true)
    setError(null)

    try {
      const response = await fetch(`/api/playground/simulate?mode=${encodeURIComponent(mode)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(circuit),
      })

      if (!response.ok) throw new Error(await describeFailure(response))

      const payload = await response.json()
      if (activeRef.current) setResult(payload)
      return payload
    } catch (caught) {
      if (activeRef.current) {
        setError(caught.message)
        // A failed run must clear the previous histogram. Leaving it on screen
        // next to an error would show results for a circuit that no longer
        // matches what the user is looking at.
        setResult(null)
      }
      return null
    } finally {
      if (activeRef.current) setIsRunning(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, isRunning, error, run, reset }
}
