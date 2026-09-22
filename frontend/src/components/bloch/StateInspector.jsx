import { ScanSearch } from 'lucide-react'

import { densityMatrix, length, p0, purity, toAmplitudes, toAngles } from '../../quantum/bloch'
import { format } from '../../quantum/complex'
import { fmt, fmtDeg, Meter, Panel } from './ui'

/** Every number that describes the current qubit, from friendliest to most formal. */
export default function StateInspector({ vec }) {
  const r = length(vec)
  const pure = r > 0.999
  const { theta, phi } = toAngles(vec)
  const [alpha, beta] = toAmplitudes(vec)
  const rho = densityMatrix(vec)
  const zero = p0(vec)

  return (
    <Panel title="State inspector" icon={ScanSearch}>
      <div className="space-y-3">
        <Meter label="P(measure 0)" value={zero} tone="cyan" />
        <Meter label="P(measure 1)" value={1 - zero} tone="violet" />

        <dl className="grid grid-cols-3 gap-2 font-mono text-[11px]">
          {[
            ['x', fmt(vec.x)],
            ['y', fmt(vec.y)],
            ['z', fmt(vec.z)],
            ['θ', fmtDeg(theta)],
            ['φ', r * Math.sin(theta) < 1e-6 ? '—' : fmtDeg(phi)],
            ['|r|', fmt(r)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md bg-lab-850 px-2 py-1.5">
              <dt className="text-[10px] text-slate-500">{k}</dt>
              <dd className="text-slate-200">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="rounded-lg border border-lab-700 bg-lab-850/60 px-3 py-2.5">
          {pure ? (
            <>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">State vector</p>
              <p className="mt-1 break-words font-mono text-sm text-slate-100">
                |ψ⟩ = <span className="text-signal-cyan">{format(alpha)}</span>|0⟩ +{' '}
                <span className="text-signal-violet">({format(beta)})</span>|1⟩
              </p>
              <p className="mt-1 font-mono text-[10px] text-slate-500">
                α = cos(θ/2) · β = e^{'{'}iφ{'}'} sin(θ/2) · global phase dropped (it is unobservable)
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-wider text-signal-amber">Mixed state</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                The arrow is inside the sphere, so no single |ψ⟩ describes this qubit — it is a statistical blend. Only the
                density matrix below can.
              </p>
            </>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500">
            <span>Density matrix ρ</span>
            <span className="normal-case tracking-normal">
              purity Tr(ρ²) = <span className="font-mono text-slate-300">{fmt(purity(vec))}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg border-x-2 border-slate-600 px-2 py-1 font-mono text-[11px] text-slate-200">
            {rho.flat().map((cell, i) => (
              <span key={i} className="text-center">
                {format(cell)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}
