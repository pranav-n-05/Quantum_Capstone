import { useMemo, useState } from 'react'

import { range, rng } from '../../../quantum/numeric'
import { STEANE, steaneAddress, SURFACE } from '../../../quantum/labs/qec'
import { useThemeColors } from '../../../hooks/useThemeColors'
import { Button, Slider } from '../../bloch/ui'
import { LabSection, LineChartBox, Note, Stat, Stats } from './kit'

const CYCLE = ['I', 'X', 'Z', 'Y']
const masks = (errs) => ({
  x: errs.reduce((m, e, q) => (e === 'X' || e === 'Y' ? m | (1 << q) : m), 0),
  z: errs.reduce((m, e, q) => (e === 'Z' || e === 'Y' ? m | (1 << q) : m), 0),
})
const ERR_COLOR = { X: 'signal-rose', Z: 'signal-cyan', Y: 'signal-violet' }

function Legend() {
  return (
    <p className="text-[10px] text-slate-500">
      Click a qubit to cycle its error: none → <span className="text-signal-rose">X</span> → <span className="text-signal-cyan">Z</span> → <span className="text-signal-violet">Y</span>.
    </p>
  )
}

// --- Steane -------------------------------------------------------------------------

// Triangle layout: corners 0, 1, 3; edge midpoints 2 (0–1), 4 (0–3), 5 (1–3); centre 6.
const P = { 0: [40, 230], 1: [160, 22], 3: [280, 230], 2: [100, 126], 4: [160, 230], 5: [220, 126], 6: [160, 160] }
const FACES = [
  { qubits: [3, 4, 6, 5], row: 0, bit: 4 },
  { qubits: [1, 5, 6, 2], row: 1, bit: 2 },
  { qubits: [0, 2, 6, 4], row: 2, bit: 1 },
]

export function SteaneLab() {
  const c = useThemeColors()
  const [errs, setErrs] = useState(() => range(7).map((q) => (q === 4 ? 'X' : 'I')))
  const { x, z } = masks(errs)
  const d = STEANE.decode(x, z)
  const xAddr = steaneAddress(d.zSyndrome)
  const zAddr = steaneAddress(d.xSyndrome)
  const count = errs.filter((e) => e !== 'I').length
  const toggle = (q) => setErrs((es) => es.map((e, i) => (i === q ? CYCLE[(CYCLE.indexOf(e) + 1) % 4] : e)))

  return (
    <div className="space-y-4">
      <LabSection title="Seven qubits, three checks" aside={<Button onClick={() => setErrs(range(7).map(() => 'I'))}>Clear</Button>}>
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <svg viewBox="0 0 320 260" className="w-full max-w-[320px]">
            {FACES.map((f) => {
              const lit = d.zSyndrome[f.row] || d.xSyndrome[f.row]
              return (
                <polygon
                  key={f.row}
                  points={f.qubits.map((q) => P[q].join(',')).join(' ')}
                  fill={lit ? c['signal-amber'] : c['lab-800']}
                  fillOpacity={lit ? 0.35 : 0.6}
                  stroke={c['lab-600']}
                />
              )
            })}
            {range(7).map((q) => {
              const e = errs[q]
              return (
                <g key={q} onClick={() => toggle(q)} className="cursor-pointer">
                  <circle cx={P[q][0]} cy={P[q][1]} r={17} fill={e === 'I' ? c['lab-850'] : c[ERR_COLOR[e]]} stroke={c['slate-400']} strokeWidth={1.5} />
                  <text x={P[q][0]} y={P[q][1] + 4} textAnchor="middle" fontSize={11} fontFamily="ui-monospace, monospace" fill={e === 'I' ? c['slate-200'] : c['lab-950']}>
                    {e === 'I' ? q + 1 : e}
                  </text>
                </g>
              )
            })}
          </svg>
          <div className="space-y-3">
            <Legend />
            <Stats>
              <Stat label="Z-checks (catch X)" value={d.zSyndrome.join('')} tone={xAddr ? 'rose' : 'green'} />
              <Stat label="→ X error at qubit" value={xAddr || '—'} tone="rose" />
              <Stat label="X-checks (catch Z)" value={d.xSyndrome.join('')} tone={zAddr ? 'cyan' : 'green'} />
              <Stat label="→ Z error at qubit" value={zAddr || '—'} tone="cyan" />
            </Stats>
            <Note tone={d.logicalXError || d.logicalZError ? 'rose' : 'green'}>
              {count === 0
                ? 'No errors: every check passes.'
                : d.logicalXError || d.logicalZError
                  ? `${count} errors: the syndrome points at the wrong qubit, and "fixing" it completes a logical error. Distance 3 means one error is always fixable, two are not.`
                  : `Corrected. Read each syndrome as a binary number — it is the position of the faulty qubit (numbers 1–7 on the diagram).`}
            </Note>
          </div>
        </div>
      </LabSection>
      <LabSection title="Transversal gates — why Steane mattered">
        <table className="w-full text-left text-xs">
          <tbody>
            {[
              ['H on all 7 qubits', 'Logical H̄', 'X- and Z-checks are the same rows, so H swaps them and keeps the code.'],
              ['S† on all 7 qubits', 'Logical S̄', 'Phases add up to the logical phase gate.'],
              ['CNOT qubit-by-qubit between two blocks', 'Logical CNOT', 'Never couples two qubits of the same block, so one fault stays one fault.'],
              ['T gate', 'not transversal', 'Needs magic-state distillation — true for every code (Eastin–Knill).'],
            ].map(([a, b, why]) => (
              <tr key={a} className="border-t border-lab-700/60 align-top">
                <td className="py-1.5 pr-2 font-mono text-slate-300">{a}</td>
                <td className="py-1.5 pr-2 text-signal-cyan">{b}</td>
                <td className="py-1.5 text-slate-400">{why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </LabSection>
    </div>
  )
}

// --- Surface code ---------------------------------------------------------------------

const S = 70 // pixels per grid unit
const O = 50 // margin
const at = (q) => [O + (q % 3) * S, O + Math.floor(q / 3) * S]

function plaquettePath(qubits, centre) {
  const pts = qubits.map(at)
  if (qubits.length === 4) {
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    return `M${Math.min(...xs)},${Math.min(...ys)} H${Math.max(...xs)} V${Math.max(...ys)} H${Math.min(...xs)} Z`
  }
  // weight-2 boundary check: a half-disc bulging away from the patch
  const [a, b] = pts
  const cx = O + centre[0] * S
  const cy = O + centre[1] * S
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  // Bulge toward the check's centre, which sits just outside the patch.
  const sweep = (b[0] - a[0]) * (cy - my) - (b[1] - a[1]) * (cx - mx) > 0 ? 0 : 1
  return `M${a[0]},${a[1]} A${S / 2},${S / 2} 0 0 ${sweep} ${b[0]},${b[1]} Z`
}

export function SurfaceLab() {
  const c = useThemeColors()
  const [errs, setErrs] = useState(() => range(9).map((q) => (q === 4 ? 'X' : 'I')))
  const [p, setP] = useState(0.05)
  const [seed, setSeed] = useState(1)
  const [showFix, setShowFix] = useState(false)
  const { x, z } = masks(errs)
  const d = SURFACE.decode(x, z)
  const toggle = (q) => {
    setShowFix(false)
    setErrs((es) => es.map((e, i) => (i === q ? CYCLE[(CYCLE.indexOf(e) + 1) % 4] : e)))
  }
  const randomize = () => {
    const rand = rng(seed)
    setSeed(seed + 1)
    setShowFix(false)
    setErrs(range(9).map(() => (rand() < p ? ['X', 'Z', 'Y'][Math.floor(rand() * 3)] : 'I')))
  }
  const curve = useMemo(
    () =>
      range(30).map((k) => {
        const pp = 10 ** (-3 + (k * 2.5) / 29)
        return { p: pp, logical: SURFACE.logicalRate(pp), bare: pp }
      }),
    [],
  )
  const breakEven = curve.find((pt) => pt.logical > pt.bare)?.p

  return (
    <div className="space-y-4">
      <LabSection title="Distance-3 surface code: 9 data qubits, 8 checks">
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <svg viewBox="0 0 240 240" className="w-full max-w-[260px]">
            {SURFACE.layout.x.map((pl, i) => (
              <path key={`x${i}`} d={plaquettePath(pl.qubits, pl.at)} fill={c['signal-rose']} fillOpacity={d.xSyndrome[i] ? 0.75 : 0.14} stroke={c['signal-rose']} strokeOpacity={0.6} />
            ))}
            {SURFACE.layout.z.map((pl, i) => (
              <path key={`z${i}`} d={plaquettePath(pl.qubits, pl.at)} fill={c['signal-cyan']} fillOpacity={d.zSyndrome[i] ? 0.75 : 0.14} stroke={c['signal-cyan']} strokeOpacity={0.6} />
            ))}
            {range(9).map((q) => {
              const [px, py] = at(q)
              const e = errs[q]
              const fixed = showFix && (((d.corrX >> q) & 1) || ((d.corrZ >> q) & 1))
              return (
                <g key={q} onClick={() => toggle(q)} className="cursor-pointer">
                  {fixed && <circle cx={px} cy={py} r={17} fill="none" stroke={c['signal-green']} strokeWidth={3} strokeDasharray="4 3" />}
                  <circle cx={px} cy={py} r={12} fill={e === 'I' ? c['lab-850'] : c[ERR_COLOR[e]]} stroke={c['slate-200']} strokeWidth={1.4} />
                  <text x={px} y={py + 4} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill={e === 'I' ? c['slate-400'] : c['lab-950']}>
                    {e === 'I' ? q : e}
                  </text>
                </g>
              )
            })}
          </svg>
          <div className="space-y-3">
            <Legend />
            <p className="text-[10px] text-slate-500">
              <span className="text-signal-rose">Red</span> squares are X-checks (they light up for Z errors); <span className="text-signal-cyan">cyan</span> are Z-checks (lit by X errors). A bright check marks the end of an error chain.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => setShowFix(true)}>Decode</Button>
              <Button onClick={() => (setErrs(range(9).map(() => 'I')), setShowFix(false))}>Clear</Button>
              <Button onClick={randomize}>Random errors at p</Button>
              <span className="w-40"><Slider label="p" unit="" value={p} min={0.01} max={0.3} step={0.01} onChange={setP} /></span>
            </div>
            {showFix && (
              <Note tone={d.logicalXError || d.logicalZError ? 'rose' : 'green'}>
                {d.logicalXError || d.logicalZError
                  ? 'Logical error: the errors plus the decoder’s fix form a chain that crosses the patch from one boundary to the opposite one. It is invisible to every check — and it flipped the stored qubit.'
                  : 'Corrected (green rings = the decoder’s fix). Errors + fix form only closed loops or stabilizers, which do nothing to the stored qubit.'}
              </Note>
            )}
          </div>
        </div>
      </LabSection>
      <LabSection title="Does encoding help? Logical vs. physical error rate (bit-flip noise)">
        <LineChartBox data={curve} x="p" xLog yLog yDomain={[1e-6, 1]} xLabel="physical error probability p" yLabel="error probability" series={[{ key: 'bare', label: 'one bare qubit (p)', color: 'slate-400', dashed: true }, { key: 'logical', label: 'd = 3 logical qubit (exact)' }]} height={250} />
        <p className="text-xs text-slate-400">
          For small p the logical rate falls like ~p² — two errors are needed to fool the decoder — so encoding wins below p ≈ {breakEven ? breakEven.toFixed(2) : '?'}. Bigger codes (d = 5, 7, …) fall like p³, p⁴… : that exponential suppression below threshold is what Google demonstrated in 2024.
        </p>
      </LabSection>
    </div>
  )
}

