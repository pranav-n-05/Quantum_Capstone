import { useEffect, useState } from 'react'
import { Grid3x3 } from 'lucide-react'

import { axisRotation, MATRICES, rx, ry, rz, u } from '../../quantum/gates'
import { fromAngles, KET } from '../../quantum/bloch'
import { Button, DEG, Panel, Slider, Tabs } from './ui'

const FIXED = [
  { id: 'x', label: 'X', hint: 'Half-turn about x̂ — the quantum NOT' },
  { id: 'y', label: 'Y', hint: 'Half-turn about ŷ' },
  { id: 'z', label: 'Z', hint: 'Half-turn about ẑ — flips the phase' },
  { id: 'h', label: 'H', hint: 'Half-turn about (x̂+ẑ)/√2 — swaps |0⟩↔|+⟩' },
  { id: 's', label: 'S', hint: 'Quarter-turn about ẑ (90°)' },
  { id: 'sdg', label: 'S†', hint: 'Quarter-turn back (−90°)' },
  { id: 't', label: 'T', hint: 'Eighth-turn about ẑ (45°)' },
  { id: 'tdg', label: 'T†', hint: 'Eighth-turn back (−45°)' },
]

const PREP = [
  { label: '|0⟩', v: KET.zero },
  { label: '|1⟩', v: KET.one },
  { label: '|+⟩', v: KET.plus },
  { label: '|−⟩', v: KET.minus },
  { label: '|+i⟩', v: KET.plusI },
  { label: '|−i⟩', v: KET.minusI },
]

const ROT = { x: rx, y: ry, z: rz }

/**
 * Every way the lab can change the state: the named gates, axis rotations,
 * a rotation about any axis, Qiskit's general U gate, and direct preparation.
 *
 * `allowed` (from a challenge) greys out everything else; `lockPrep` hides the
 * shortcut of simply setting the answer.
 */
export default function GatePad({ onGate, onPrepare, onAxisPreview, allowed = null, lockPrep = false }) {
  const [tab, setTab] = useState('rotate')
  const [axis, setAxis] = useState('y')
  const [angle, setAngle] = useState(90)
  const [nTheta, setNTheta] = useState(45)
  const [nPhi, setNPhi] = useState(0)
  const [gamma, setGamma] = useState(180)
  const [uT, setUT] = useState(90)
  const [uP, setUP] = useState(0)
  const [uL, setUL] = useState(180)
  const [pTheta, setPTheta] = useState(60)
  const [pPhi, setPPhi] = useState(45)

  const ok = (id) => !allowed || allowed.includes(id)
  const n = fromAngles(nTheta * DEG, nPhi * DEG)

  // While the custom-axis tab is open the sphere draws n̂, so the rotation
  // the sliders describe is something you can see before you apply it.
  useEffect(() => {
    onAxisPreview?.(tab === 'axis' ? fromAngles(nTheta * DEG, nPhi * DEG) : null)
  }, [tab, nTheta, nPhi, onAxisPreview])
  useEffect(() => () => onAxisPreview?.(null), [onAxisPreview])

  return (
    <Panel title="Gates" icon={Grid3x3}>
      <div className="grid grid-cols-4 gap-1.5">
        {FIXED.map((g) => (
          <button
            key={g.id}
            type="button"
            disabled={!ok(g.id)}
            title={g.hint}
            onClick={() => onGate(g.label, MATRICES[g.id], g.id)}
            className="rounded-lg border border-lab-700 bg-lab-850 py-2 font-mono text-sm font-semibold text-slate-200 transition-colors hover:border-signal-cyan/50 hover:text-signal-cyan focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'rotate', label: 'Rotate' },
            { value: 'axis', label: 'Any axis' },
            { value: 'u', label: 'U(θ,φ,λ)' },
            ...(lockPrep ? [] : [{ value: 'prep', label: 'Prepare' }]),
          ]}
        />
      </div>

      <div className="mt-3 space-y-3">
        {tab === 'rotate' && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Axis</span>
              <Tabs value={axis} onChange={setAxis} tabs={['x', 'y', 'z'].map((a) => ({ value: a, label: `R${a}` }))} />
            </div>
            <Slider label="Angle γ" value={angle} min={-180} max={180} onChange={setAngle} />
            <div className="flex flex-wrap items-center gap-1.5">
              {[-90, -45, 45, 90, 180].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAngle(a)}
                  className="rounded-md border border-lab-700 px-2 py-0.5 font-mono text-[10px] text-slate-400 hover:text-slate-200"
                >
                  {a > 0 ? '+' : ''}
                  {a}°
                </button>
              ))}
              <Button
                variant="primary"
                className="ml-auto"
                disabled={!ok(`r${axis}`)}
                onClick={() => onGate(`R${axis}(${angle}°)`, ROT[axis](angle * DEG), `r${axis}`)}
              >
                Apply R{axis}
              </Button>
            </div>
          </>
        )}

        {tab === 'axis' && (
          <>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Every single-qubit gate is a rotation about <em>some</em> axis. Pick the axis n̂ by its direction on the sphere,
              then how far to turn. The violet ghost shows n̂.
            </p>
            <Slider label="Axis tilt from ẑ" value={nTheta} min={0} max={180} onChange={setNTheta} />
            <Slider label="Axis azimuth" value={nPhi} min={-180} max={180} onChange={setNPhi} />
            <Slider label="Turn γ" value={gamma} min={-180} max={180} onChange={setGamma} />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-slate-500">
                n̂ = ({n.x.toFixed(2)}, {n.y.toFixed(2)}, {n.z.toFixed(2)})
              </span>
              <Button
                variant="primary"
                disabled={!ok('rn')}
                onClick={() => onGate(`Rn(${gamma}°)`, axisRotation([n.x, n.y, n.z], gamma * DEG), 'rn')}
              >
                Rotate
              </Button>
            </div>
          </>
        )}

        {tab === 'u' && (
          <>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Qiskit&apos;s universal gate. From |0⟩, U(θ, φ, λ) lands exactly at polar angle θ and azimuth φ — λ only
              matters for states that are not |0⟩.
            </p>
            <Slider label="θ" value={uT} min={0} max={180} onChange={setUT} />
            <Slider label="φ" value={uP} min={-180} max={180} onChange={setUP} />
            <Slider label="λ" value={uL} min={-180} max={180} onChange={setUL} />
            <div className="flex justify-end">
              <Button
                variant="primary"
                disabled={!ok('u')}
                onClick={() => onGate(`U(${uT},${uP},${uL})`, u(uT * DEG, uP * DEG, uL * DEG), 'u')}
              >
                Apply U
              </Button>
            </div>
          </>
        )}

        {tab === 'prep' && !lockPrep && (
          <>
            <div className="grid grid-cols-6 gap-1">
              {PREP.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onPrepare(p.label, p.v)}
                  className="rounded-md border border-lab-700 py-1 font-mono text-[11px] text-slate-300 hover:border-signal-cyan/50 hover:text-signal-cyan"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Slider label="Polar θ" value={pTheta} min={0} max={180} onChange={setPTheta} />
            <Slider label="Azimuth φ" value={pPhi} min={-180} max={180} onChange={setPPhi} />
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => onPrepare(`θ${pTheta}° φ${pPhi}°`, fromAngles(pTheta * DEG, pPhi * DEG))}>
                Set state
              </Button>
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}
