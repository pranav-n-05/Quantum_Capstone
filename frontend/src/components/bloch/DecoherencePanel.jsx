import { useState } from 'react'
import { Hourglass } from 'lucide-react'

import { length, purity, relax } from '../../quantum/bloch'
import { Button, fmt, Panel, Slider, Tabs } from './ui'

/**
 * Illustrative coherence times, in µs. These are typical published figures for
 * each processor family, not live calibration data -- the telemetry API this
 * dashboard reads does not report per-device T1/T2.
 */
const PRESETS = {
  heron: { label: 'Heron-class', t1: 250, t2: 180 },
  eagle: { label: 'Eagle-class', t1: 200, t2: 120 },
  falcon: { label: 'Older / noisy', t1: 90, t2: 60 },
}

/**
 * Real qubits leak. T1 drags the arrow down toward |0⟩ (energy loss); T2
 * erases the phase, collapsing the arrow toward the vertical axis. Together
 * they pull any state into the ball -- which is why circuits have to finish
 * fast.
 */
export default function DecoherencePanel({ vec, onIdle, disabled }) {
  const [preset, setPreset] = useState('eagle')
  const [t1, setT1] = useState(PRESETS.eagle.t1)
  const [t2, setT2] = useState(PRESETS.eagle.t2)
  const [idle, setIdle] = useState(100)

  const pick = (key) => {
    setPreset(key)
    setT1(PRESETS[key].t1)
    setT2(PRESETS[key].t2)
  }

  // Physics requires T2 ≤ 2·T1.
  const t2Eff = Math.min(t2, 2 * t1)
  const after = relax(vec, { t1, t2: t2Eff }, idle)

  return (
    <Panel title="Decoherence" icon={Hourglass}>
      <div className="space-y-3">
        <Tabs
          value={preset}
          onChange={pick}
          tabs={[...Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })), { value: 'custom', label: 'Custom' }]}
        />
        <Slider label="T1 · energy relaxation" unit=" µs" value={t1} min={10} max={400} onChange={(v) => { setT1(v); setPreset('custom') }} />
        <Slider label="T2 · dephasing" unit=" µs" value={t2Eff} min={5} max={Math.min(500, 2 * t1)} onChange={(v) => { setT2(v); setPreset('custom') }} />
        <Slider label="Idle time" unit=" µs" value={idle} min={5} max={500} step={5} onChange={setIdle} />

        <div className="flex items-center justify-between gap-2 rounded-lg bg-lab-850 px-3 py-2 font-mono text-[11px]">
          <span className="text-slate-400">
            |r| {fmt(length(vec), 2)} → <span className="text-signal-amber">{fmt(length(after), 2)}</span>
          </span>
          <span className="text-slate-400">
            purity {fmt(purity(vec), 2)} → <span className="text-signal-amber">{fmt(purity(after), 2)}</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] leading-relaxed text-slate-500">Typical family figures, for intuition — not live calibration.</p>
          <Button variant="primary" disabled={disabled} onClick={() => onIdle(`idle ${idle}µs`, after)}>
            Let it idle
          </Button>
        </div>
      </div>
    </Panel>
  )
}
