import { useState } from 'react'

import { ALGORITHMS, defaultParams } from './library'
import StepDebugger from './StepDebugger'

/**
 * The algorithm library: a rail of algorithms on the left, the selected one
 * open in the step-through debugger on the right. Knob settings are kept per
 * algorithm, so switching away and back does not lose your choices.
 */
export default function AlgorithmsView() {
  const [selectedId, setSelectedId] = useState(ALGORITHMS[0].id)
  const [paramsById, setParamsById] = useState(() => Object.fromEntries(ALGORITHMS.map((a) => [a.id, defaultParams(a)])))

  const algorithm = ALGORITHMS.find((a) => a.id === selectedId)
  const params = paramsById[selectedId]

  return (
    <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav aria-label="Algorithms" className="lg:sticky lg:top-5 lg:self-start">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Algorithm library</p>
        <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {ALGORITHMS.map((a, i) => {
            const active = a.id === selectedId
            return (
              <li key={a.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  aria-current={active ? 'true' : undefined}
                  className={`w-52 rounded-xl border px-3 py-2.5 text-left transition-colors lg:w-full ${
                    active ? 'border-signal-cyan/50 bg-signal-cyan/10' : 'border-lab-700/70 bg-lab-900/60 hover:border-lab-600'
                  }`}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-slate-600">{String(i + 1).padStart(2, '0')}</span>
                    <span className={`text-sm font-medium ${active ? 'text-signal-cyan' : 'text-slate-200'}`}>{a.name}</span>
                  </span>
                  <span className="mt-0.5 block pl-6 text-[10px] text-slate-500">
                    {a.level} · {a.category}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <StepDebugger
        key={algorithm.id}
        algorithm={algorithm}
        params={params}
        onParamChange={(key, value) => setParamsById((all) => ({ ...all, [selectedId]: { ...all[selectedId], [key]: value } }))}
      />
    </div>
  )
}
