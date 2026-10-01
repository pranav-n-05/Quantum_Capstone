import { useMemo, useState } from 'react'

import { range, rng } from '../../../quantum/numeric'
import { ghzFringe, heisenbergPrecision, randomizedBenchmarking, sqlPrecision, tomography, tomographyCurve } from '../../../quantum/labs/characterization'
import BlochSphere3D from '../../bloch/BlochSphere3D'
import { Slider, Tabs } from '../../bloch/ui'
import { BarChartBox, LabSection, LineChartBox, Note, pct, SeedControl, Stat, Stats } from './kit'

// --- Tomography ---------------------------------------------------------------------

const HIDDEN = {
  tilted: { label: 'θ=60°, φ=45°', r: { x: Math.sin(Math.PI / 3) * Math.SQRT1_2, y: Math.sin(Math.PI / 3) * Math.SQRT1_2, z: 0.5 } },
  plusI: { label: '|+i⟩', r: { x: 0, y: 1, z: 0 } },
  mixed: { label: 'mixed (|r| = 0.6)', r: { x: 0.36, y: 0, z: 0.48 } },
}
const SHOTS = [10, 30, 100, 300, 1000, 3000, 10000]

export function TomographyLab() {
  const [state, setState] = useState('tilted')
  const [shotIdx, setShotIdx] = useState(2)
  const [seed, setSeed] = useState(1)
  const shots = SHOTS[shotIdx]
  const r = HIDDEN[state].r
  const est = useMemo(() => tomography(r, shots, rng(seed)), [r, shots, seed])
  const curve = useMemo(() => tomographyCurve(r, SHOTS, 60).map((pt) => ({ ...pt, guide: 1.1 / Math.sqrt(pt.shots) })), [r])
  const bars = ['X', 'Y', 'Z'].map((axis, i) => ({ axis, plus: est.counts[i], minus: shots - est.counts[i] }))
  return (
    <div className="space-y-4">
      <LabSection title="Reconstruct a hidden state" aside={<SeedControl seed={seed} onSeed={setSeed} />}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[11px] text-slate-400">Hidden state (the device’s output)</p>
              <Tabs value={state} onChange={setState} tabs={Object.entries(HIDDEN).map(([value, h]) => ({ value, label: h.label }))} />
            </div>
            <Slider label="Shots per axis" unit="" value={shotIdx} min={0} max={SHOTS.length - 1} step={1} onChange={setShotIdx} />
            <p className="-mt-2 font-mono text-[11px] text-signal-cyan">N = {shots.toLocaleString()} per axis</p>
            <BarChartBox data={bars} x="axis" series={[{ key: 'plus', label: 'outcome +' }, { key: 'minus', label: 'outcome −', color: 'signal-violet' }]} height={170} />
          </div>
          <div>
            <BlochSphere3D vector={est.physical} ghost={r} className="h-64 w-full" />
            <p className="text-center text-[10px] text-slate-500">cyan = estimate · violet ghost = true state</p>
          </div>
        </div>
        <Stats>
          <Stat label="Estimate x, y, z" value={`${est.raw.x.toFixed(2)}, ${est.raw.y.toFixed(2)}, ${est.raw.z.toFixed(2)}`} />
          <Stat label="True x, y, z" value={`${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)}`} />
          <Stat label="Error |r̂ − r|" value={est.error.toFixed(3)} tone="amber" />
          <Stat label="Fidelity" value={pct(est.fidelity, 2)} tone="green" />
        </Stats>
      </LabSection>
      <LabSection title="Precision costs shots: error ∝ 1/√N">
        <LineChartBox data={curve} x="shots" xLog yLog xLabel="shots per axis" yLabel="mean |r̂ − r|" series={[{ key: 'error', label: 'simulated (60 trials each)', dots: true }, { key: 'guide', label: '∝ 1/√N', dashed: true, color: 'slate-400' }]} dots={[{ x: shots, y: est.error }]} />
        <Note>One qubit needs 3 settings; n qubits need 3ⁿ — 59 049 for ten qubits. That exponential cost is why bigger devices are judged with randomized benchmarking instead.</Note>
      </LabSection>
    </div>
  )
}

// --- Randomized benchmarking ----------------------------------------------------------

export function RbLab() {
  const [p, setP] = useState(1)
  const [eps, setEps] = useState(0)
  const [shots, setShots] = useState('0')
  const [seed, setSeed] = useState(9)
  const rb = useMemo(() => randomizedBenchmarking({ p: p / 100, eps, sequences: 30, shots: Number(shots), seed }), [p, eps, shots, seed])
  const data = rb.points.map((pt) => ({ m: pt.m, survival: pt.survival, fit: 0.5 + rb.A * rb.f ** pt.m }))
  return (
    <div className="space-y-4">
      <LabSection title="Noisy gates, random sequences" aside={<SeedControl seed={seed} onSeed={setSeed} />}>
        <div className="grid gap-3 md:grid-cols-3">
          <Slider label="Depolarising error per gate" unit="%" value={p} min={0} max={5} step={0.1} onChange={setP} />
          <Slider label="Coherent over-rotation ε" unit=" rad" value={eps} min={0} max={0.3} step={0.01} onChange={setEps} />
          <div>
            <p className="mb-1 text-[11px] text-slate-400">Shots per sequence</p>
            <Tabs value={shots} onChange={setShots} tabs={[{ value: '0', label: 'exact' }, { value: '1000', label: '1 000' }, { value: '100', label: '100' }]} />
          </div>
        </div>
        <LineChartBox
          data={data}
          x="m"
          xLabel="sequence length m (Cliffords)"
          yLabel="survival P(0)"
          yDomain={[0.4, 1]}
          series={[{ key: 'survival', label: 'measured (30 random sequences)', dots: true }, { key: 'fit', label: 'fit A·fᵐ + ½', dashed: true, color: 'signal-amber' }]}
          refLines={[{ y: 0.5, label: 'fully random', color: 'slate-500' }]}
          height={250}
        />
        <Stats>
          <Stat label="Fitted f" value={rb.f.toFixed(5)} />
          <Stat label="Error per Clifford r" value={pct(rb.errorPerClifford, 3)} tone="cyan" />
          <Stat label="Gate fidelity 1 − r" value={pct(1 - rb.errorPerClifford, 3)} tone="green" />
          <Stat label="Expected r (depol. only)" value={pct(p / 200, 3)} hint="p/2 for pure depolarising noise" />
        </Stats>
        <Note>
          {eps > 0
            ? 'A coherent over-rotation is not random noise, yet averaging over random Cliffords turns it into an exponential decay too — RB reports it as an effective error rate.'
            : 'With pure depolarising noise the fit recovers r = p/2 exactly. Try adding a coherent over-rotation, or fewer shots, and watch the estimate stay robust.'}
        </Note>
      </LabSection>
    </div>
  )
}

// --- Clock synchronisation --------------------------------------------------------------

export function ClockLab() {
  const [N, setN] = useState(4)
  const [M, setM] = useState(100)
  const fringe = range(121).map((k) => {
    const phi = (k / 120) * Math.PI
    return { phi: +(phi * (180 / Math.PI)).toFixed(1), single: ghzFringe(1, phi), ghz: ghzFringe(N, phi) }
  })
  const scaling = range(20).map((k) => ({ N: k + 1, sql: sqlPrecision(k + 1, M), hl: heisenbergPrecision(k + 1, M) }))
  return (
    <div className="space-y-4">
      <LabSection title="Entangled qubits make a steeper fringe">
        <Slider label="Qubits in the GHZ state (N)" unit="" value={N} min={1} max={10} step={1} onChange={setN} />
        <LineChartBox data={fringe} x="phi" xLabel="phase per qubit φ (degrees) — proportional to clock offset" yLabel="P(0)" yDomain={[0, 1]} series={[{ key: 'single', label: '1 qubit: cos²(φ/2)', color: 'slate-400', dashed: true }, { key: 'ghz', label: `GHZ of ${N}: cos²(Nφ/2)` }]} height={230} />
        <p className="text-xs text-slate-400">The steeper the fringe, the smaller the phase change that flips the outcome — so the same number of runs pins the clock offset down more tightly.</p>
      </LabSection>
      <LabSection title="Precision: standard quantum limit vs. Heisenberg limit">
        <Slider label="Repetitions M" unit="" value={M} min={10} max={1000} step={10} onChange={setM} />
        <LineChartBox data={scaling} x="N" xLog yLog xLabel="number of qubits N" yLabel="phase uncertainty (rad)" series={[{ key: 'sql', label: 'N independent qubits: 1/√(NM)', color: 'signal-violet' }, { key: 'hl', label: 'GHZ: 1/(N√M)' }]} height={230} />
        <Stats>
          <Stat label="Independent, N=" value={`${N}: ${sqlPrecision(N, M).toExponential(2)}`} tone="violet" />
          <Stat label="Entangled, N=" value={`${N}: ${heisenbergPrecision(N, M).toExponential(2)}`} tone="cyan" />
          <Stat label="Gain" value={`${Math.sqrt(N).toFixed(2)}×`} tone="green" />
          <Stat label="Offset Δt at 10 GHz" value={`${((heisenbergPrecision(N, M) / (2 * Math.PI * 1e10)) * 1e15).toFixed(2)} fs`} hint="Δt = Δφ / ω" />
        </Stats>
        <Note>Caveat: GHZ states are N times more fragile too — decoherence or a phase drift beyond ±π/N makes the fringe ambiguous, which is why practical schemes mix entangled and unentangled stages.</Note>
      </LabSection>
    </div>
  )
}
