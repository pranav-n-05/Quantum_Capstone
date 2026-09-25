import { useEffect, useMemo, useRef, useState } from 'react'
import { Radio } from 'lucide-react'

import { useThemeColors } from '../../hooks/useThemeColors'
import { drive, driveAngle, driveAxis } from '../../quantum/bloch'
import { Button, DEG, fmt, Panel, Slider } from './ui'

const T_MAX = 400 // ns shown on the chevron's time axis
const D_MAX = 20 // ±MHz shown on its detuning axis
const COLS = 80
const ROWS = 41

const p1 = (v) => (1 - v.z) / 2

/**
 * How a real qubit is actually driven: a microwave pulse with a strength
 * (Rabi rate Ω), an off-resonance error (detuning Δ), a phase that picks the
 * rotation axis in the equatorial plane, and a length.
 *
 * The chevron is the map experimentalists use to find their π-pulse: P(|1⟩)
 * after every (length, detuning) pair, starting from the current state. On
 * resonance the stripes run full-height; off resonance they narrow and fade.
 */
export default function PulsePanel({ vec, onPulse, onAxisPreview, disabled }) {
  const [rabi, setRabi] = useState(5)
  const [detuning, setDetuning] = useState(0)
  const [phaseDeg, setPhaseDeg] = useState(0)
  const [length, setLength] = useState(100)

  const d = useMemo(() => ({ rabi, detuning, phase: phaseDeg * DEG }), [rabi, detuning, phaseDeg])
  const { axis, eff } = driveAxis(d)
  const after = drive(vec, d, length)
  const turns = driveAngle(d, length) / (2 * Math.PI)

  const piPulse = () => {
    setDetuning(0)
    setLength(Math.round(1000 / (2 * rabi)))
  }

  return (
    <Panel title="Pulse drive · Rabi chevron" icon={Radio}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className="space-y-3"
          onPointerEnter={() => onAxisPreview?.({ x: axis[0], y: axis[1], z: axis[2] })}
          onPointerLeave={() => onAxisPreview?.(null)}
        >
          <Slider label="Rabi rate Ω" unit=" MHz" value={rabi} min={0.5} max={20} step={0.5} onChange={setRabi} />
          <Slider label="Detuning Δ" unit=" MHz" value={detuning} min={-D_MAX} max={D_MAX} step={0.5} onChange={setDetuning} />
          <Slider label="Drive phase φ" value={phaseDeg} min={0} max={360} step={5} onChange={setPhaseDeg} />
          <Slider label="Pulse length" unit=" ns" value={length} min={0} max={T_MAX} step={2} onChange={setLength} />

          <div className="grid grid-cols-3 gap-2 rounded-lg bg-lab-850 px-3 py-2 font-mono text-[11px]">
            <span className="text-slate-400">
              Ω<sub>eff</sub> <span className="text-slate-200">{fmt(eff, 2)}</span>
            </span>
            <span className="text-slate-400">
              turns <span className="text-slate-200">{fmt(turns, 2)}</span>
            </span>
            <span className="text-slate-400">
              P(1) {fmt(p1(vec), 2)}→<span className="text-signal-cyan">{fmt(p1(after), 2)}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button onClick={piPulse} title="On resonance, length 1/(2Ω)">
              Find π-pulse
            </Button>
            <Button
              variant="primary"
              disabled={disabled || eff === 0 || length === 0}
              onClick={() => onPulse(`pulse ${length}ns`, axis, driveAngle(d, length))}
            >
              Fire pulse
            </Button>
          </div>
        </div>

        <Chevron
          vec={vec}
          rabi={rabi}
          phase={phaseDeg * DEG}
          marker={{ t: length, d: detuning }}
          onPick={(t, dt) => {
            setLength(t)
            setDetuning(dt)
          }}
        />
      </div>
    </Panel>
  )
}

/** P(|1⟩) over pulse length × detuning, painted cell by cell on a canvas. */
function Chevron({ vec, rabi, phase, marker, onPick }) {
  const ref = useRef(null)
  const colors = useThemeColors()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { width: W, height: H } = canvas
    const hot = colors['signal-cyan'].match(/\d+/g).map(Number)
    const cold = colors['lab-900'].match(/\d+/g).map(Number)
    const cw = W / COLS
    const rh = H / ROWS
    for (let r = 0; r < ROWS; r++) {
      const det = D_MAX - (2 * D_MAX * r) / (ROWS - 1)
      for (let col = 0; col < COLS; col++) {
        const t = (T_MAX * col) / (COLS - 1)
        const p = p1(drive(vec, { rabi, detuning: det, phase }, t))
        const mix = (i) => Math.round(cold[i] + (hot[i] - cold[i]) * p)
        ctx.fillStyle = `rgb(${mix(0)},${mix(1)},${mix(2)})`
        ctx.fillRect(Math.floor(col * cw), Math.floor(r * rh), Math.ceil(cw), Math.ceil(rh))
      }
    }
    // Crosshair at the pulse the sliders describe.
    const mx = (marker.t / T_MAX) * W
    const my = ((D_MAX - marker.d) / (2 * D_MAX)) * H
    ctx.strokeStyle = colors['signal-violet']
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(mx, 0)
    ctx.lineTo(mx, H)
    ctx.moveTo(0, my)
    ctx.lineTo(W, my)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(mx, my, 4, 0, 2 * Math.PI)
    ctx.stroke()
  }, [vec, rabi, phase, marker.t, marker.d, colors])

  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const fx = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
    const fy = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height))
    onPick(Math.round((fx * T_MAX) / 2) * 2, Math.round((D_MAX - fy * 2 * D_MAX) * 2) / 2)
  }

  return (
    <figure>
      <div className="flex gap-1.5">
        <div className="flex flex-col justify-between py-0.5 text-right font-mono text-[9px] text-slate-500">
          <span>+{D_MAX}</span>
          <span>Δ 0</span>
          <span>−{D_MAX}</span>
        </div>
        <canvas
          ref={ref}
          width={320}
          height={200}
          onClick={pick}
          title="Click to choose a pulse length and detuning"
          aria-label="Rabi chevron: probability of |1⟩ by pulse length and detuning"
          className="h-[200px] w-full cursor-crosshair rounded-md border border-lab-700"
        />
      </div>
      <figcaption className="mt-1 flex justify-between pl-7 font-mono text-[9px] text-slate-500">
        <span>0 ns</span>
        <span>P(|1⟩) · click to pick a pulse</span>
        <span>{T_MAX} ns</span>
      </figcaption>
    </figure>
  )
}
