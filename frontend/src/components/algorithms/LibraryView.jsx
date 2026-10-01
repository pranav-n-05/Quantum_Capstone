import { useState } from 'react'
import { Binary, ChevronLeft, Network } from 'lucide-react'

import { ALGORITHMS, defaultParams, TRACK_ORDER, TRACKS } from './library'
import StepDebugger from './StepDebugger'
import TrackChooser from './TrackChooser'

const ICONS = { protocol: Network, algorithm: Binary }

/**
 * The library: pick a track, then step through one entry in the debugger.
 *
 * Three pieces of state survive a track switch -- the chosen track, the
 * selection within each track, and every entry's knob settings -- so moving
 * between protocols and algorithms and back lands exactly where you left,
 * rather than resetting to the top of a list.
 */
export default function LibraryView() {
  const [track, setTrack] = useState(null)
  const [selectedByTrack, setSelectedByTrack] = useState(() =>
    Object.fromEntries(TRACK_ORDER.map((t) => [t, TRACKS[t].items[0].id])),
  )
  const [paramsById, setParamsById] = useState(() => Object.fromEntries(ALGORITHMS.map((a) => [a.id, defaultParams(a)])))

  if (!track) return <TrackChooser onPick={setTrack} />

  const { label, tagline, items } = TRACKS[track]
  const selectedId = selectedByTrack[track]
  const algorithm = items.find((a) => a.id === selectedId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setTrack(null)}
          className="flex items-center gap-1 rounded-lg border border-lab-700 bg-lab-900/80 px-2 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60"
        >
          <ChevronLeft size={13} />
          Library
        </button>

        <div role="radiogroup" aria-label="Track" className="inline-flex items-center rounded-lg border border-lab-700 bg-lab-900/80 p-1">
          {TRACK_ORDER.map((id) => {
            const Icon = ICONS[id]
            const active = id === track
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTrack(id)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 ${
                  active ? 'bg-signal-cyan/15 text-signal-cyan' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon size={13} />
                {TRACKS[id].label}
              </button>
            )
          })}
        </div>

        <p className="text-[11px] uppercase tracking-wider text-slate-500">{tagline}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label={label} className="lg:sticky lg:top-5 lg:self-start">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {items.map((a, i) => {
              const active = a.id === selectedId
              return (
                <li key={a.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedByTrack((all) => ({ ...all, [track]: a.id }))}
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
          params={paramsById[selectedId]}
          onParamChange={(key, value) => setParamsById((all) => ({ ...all, [selectedId]: { ...all[selectedId], [key]: value } }))}
        />
      </div>
    </div>
  )
}
