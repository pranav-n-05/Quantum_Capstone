import { useCallback, useEffect, useRef, useState } from 'react'

import { KET, rotate, rotationOf } from '../quantum/bloch'

/**
 * The Bloch Lab's single-qubit state, its undo history and its animation.
 *
 * The committed state changes instantly; `display` is what the sphere draws,
 * and it travels there along the *physical* path -- a gate animates as the
 * rotation it really is (H on |0⟩ swings round the (x+z)/√2 axis, it does not
 * slide along the shortest arc), while decoherence and measurement, which are
 * not rotations, move in a straight line through the ball.
 */

const TRAIL_LIMIT = 260

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t })
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

export function useBlochState(start = KET.zero) {
  const [timeline, setTimeline] = useState([{ label: 'start', kind: 'start', vec: start }])
  const [cursor, setCursor] = useState(0)
  const [display, setDisplay] = useState(start)
  const [trail, setTrail] = useState([start])
  const anim = useRef(null)
  const frame = useRef(0)

  const vec = timeline[cursor].vec

  const animate = useCallback((from, to, rot) => {
    cancelAnimationFrame(frame.current)
    const angle = rot ? Math.abs(rot.angle) : 0
    const duration = prefersReducedMotion() ? 0 : rot ? 280 + 420 * (angle / Math.PI) : 520
    if (duration === 0) {
      setDisplay(to)
      setTrail((t) => [...t, to].slice(-TRAIL_LIMIT))
      return
    }
    anim.current = { from, to, rot, start: performance.now(), duration }
    const tick = (now) => {
      const a = anim.current
      if (!a) return
      const t = Math.min(1, (now - a.start) / a.duration)
      const k = ease(t)
      const point = t >= 1 ? a.to : a.rot ? rotate(a.from, a.rot.axis, a.rot.angle * k) : lerp(a.from, a.to, k)
      setDisplay(point)
      setTrail((tr) => [...tr, point].slice(-TRAIL_LIMIT))
      if (t < 1) frame.current = requestAnimationFrame(tick)
      else anim.current = null
    }
    frame.current = requestAnimationFrame(tick)
  }, [])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const push = useCallback(
    (entry, rot) => {
      // A gate clicked mid-animation starts from the committed state, not the
      // half-drawn one: rotating a point that is still in flight would trace a
      // path that is not the gate's real rotation.
      setTimeline((tl) => [...tl.slice(0, cursor + 1), entry])
      setCursor((c) => c + 1)
      animate(vec, entry.vec, rot)
    },
    [vec, cursor, animate],
  )

  /** Apply a 2×2 unitary; `label` is what the timeline chip shows. */
  const applyGate = useCallback(
    (label, U) => {
      const rot = rotationOf(U)
      const next = rotate(vec, rot.axis, rot.angle)
      push({ label, kind: 'gate', vec: next, rot }, rot)
    },
    [vec, push],
  )

  /** Jump to a state by a non-unitary route (preparation, measurement, decay). */
  const setVector = useCallback((label, next, kind = 'prep') => push({ label, kind, vec: next }, null), [push])

  const undo = useCallback(() => {
    if (cursor === 0) return
    const entry = timeline[cursor]
    const prev = timeline[cursor - 1].vec
    setCursor(cursor - 1)
    animate(entry.vec, prev, entry.rot ? { axis: entry.rot.axis, angle: -entry.rot.angle } : null)
  }, [cursor, timeline, animate])

  const redo = useCallback(() => {
    if (cursor >= timeline.length - 1) return
    const entry = timeline[cursor + 1]
    setCursor(cursor + 1)
    animate(timeline[cursor].vec, entry.vec, entry.rot ?? null)
  }, [cursor, timeline, animate])

  const reset = useCallback(
    (to = KET.zero) => {
      cancelAnimationFrame(frame.current)
      anim.current = null
      setTimeline([{ label: 'start', kind: 'start', vec: to }])
      setCursor(0)
      setDisplay(to)
      setTrail([to])
    },
    [],
  )

  const clearTrail = useCallback(() => setTrail([display]), [display])

  return {
    vec,
    display,
    trail,
    timeline,
    cursor,
    canUndo: cursor > 0,
    canRedo: cursor < timeline.length - 1,
    applyGate,
    setVector,
    undo,
    redo,
    reset,
    clearTrail,
  }
}
