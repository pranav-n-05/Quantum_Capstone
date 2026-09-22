import { useCallback, useEffect, useMemo, useState } from 'react'

import { runSteps } from '../quantum/run'

/**
 * Drives the step-through debugger: builds the algorithm for the chosen
 * knobs, precomputes the state after every step, and moves a playhead.
 *
 * `step` counts steps *applied*: 0 is the initial |0…0⟩, `steps.length` is the
 * finished circuit. Every state is precomputed, so scrubbing backwards is as
 * cheap as forwards.
 */
export function useAlgorithmPlayer(algorithm, params) {
  const built = useMemo(() => algorithm.build(params), [algorithm, params])
  const states = useMemo(() => runSteps(built.qubits, built.steps), [built])
  const last = built.steps.length

  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  // A new algorithm or new knobs is a new circuit: rewind.
  useEffect(() => {
    setStep(0)
    setPlaying(false)
  }, [built])

  useEffect(() => {
    if (!playing) return undefined
    if (step >= last) {
      setPlaying(false)
      return undefined
    }
    const id = window.setTimeout(() => setStep((s) => Math.min(last, s + 1)), 1600 / speed)
    return () => window.clearTimeout(id)
  }, [playing, step, last, speed])

  const seek = useCallback((k) => setStep(Math.max(0, Math.min(last, k))), [last])
  const next = useCallback(() => setStep((s) => Math.min(last, s + 1)), [last])
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), [])
  const toggle = useCallback(() => {
    if (!playing && step >= last) setStep(0) // replay from the top
    setPlaying(!playing)
  }, [playing, step, last])

  return { built, states, state: states[step], step, last, playing, speed, setSpeed, seek, next, prev, toggle, setPlaying }
}
