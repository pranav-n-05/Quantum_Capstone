import { Link2 } from 'lucide-react'

import { fromAngles } from '../../quantum/bloch'
import { blochVector, vectorLength } from '../../quantum/statevector'
import BlochSphere3D from '../bloch/BlochSphere3D'

/**
 * One small Bloch sphere per qubit, each showing that qubit's own state with
 * the others traced out.
 *
 * The whole register is always a pure state here, so the only way a single
 * qubit's arrow can shrink is entanglement -- the length of the arrow is an
 * entanglement meter you can read at a glance.
 */
export default function QubitSpheres({ state, labels, target }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-3">
      {labels.map((label, q) => {
        const v = blochVector(state, q)
        const r = vectorLength(v)
        const entangled = r < 0.985
        const ghost = target?.qubit === q ? fromAngles(target.theta, target.phi) : null
        return (
          <div key={q} className="rounded-lg border border-lab-700/70 bg-lab-850/50">
            <div className="flex items-center justify-between px-2 pt-1.5 font-mono text-[10px]">
              <span className="text-slate-300">{label}</span>
              {entangled ? (
                <span className="flex items-center gap-1 text-signal-violet" title="This qubit is entangled with the others">
                  <Link2 size={10} /> {r < 0.02 ? 'max' : `|r| ${r.toFixed(2)}`}
                </span>
              ) : (
                <span className="text-slate-500">P1 {(((1 - v.z) / 2) * 100).toFixed(0)}%</span>
              )}
            </div>
            <BlochSphere3D
              vector={v}
              ghost={ghost}
              ghostAccent="signal-amber"
              compact
              interactive={false}
              accent={entangled ? 'signal-violet' : 'signal-cyan'}
              className="h-32 w-full"
            />
          </div>
        )
      })}
    </div>
  )
}
