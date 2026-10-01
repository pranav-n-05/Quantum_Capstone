import { ArrowRight, Binary, Check, Network } from 'lucide-react'

import { TRACK_ORDER, TRACKS } from './library'

const ICONS = { protocol: Network, algorithm: Binary }
const LETTERS = ['A', 'B']

const TONE = {
  protocol: {
    ring: 'hover:border-signal-violet/50 focus-visible:ring-signal-violet/60',
    accent: 'text-signal-violet',
    chip: 'border-signal-violet/30 bg-signal-violet/10 text-signal-violet',
    glow: 'bg-signal-violet/10',
  },
  algorithm: {
    ring: 'hover:border-signal-cyan/50 focus-visible:ring-signal-cyan/60',
    accent: 'text-signal-cyan',
    chip: 'border-signal-cyan/30 bg-signal-cyan/10 text-signal-cyan',
    glow: 'bg-signal-cyan/10',
  },
}

/**
 * The fork in the road: protocols or algorithms.
 *
 * The two tracks are not a filter over one list — they answer different
 * questions and are scored by different yardsticks, so the choice is made
 * explicitly rather than hidden in a dropdown. Each card states the
 * distinction and names everything inside, so the decision can be made
 * without entering first.
 */
export default function TrackChooser({ onPick }) {
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-slate-100">What would you like to step through?</h2>
        <p className="mx-auto mt-1.5 max-w-xl text-sm leading-relaxed text-slate-400">
          Both run in the same gate-by-gate debugger. They differ in what counts as success — moving information, or
          computing an answer.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {TRACK_ORDER.map((id, i) => {
          const track = TRACKS[id]
          const Icon = ICONS[id]
          const tone = TONE[id]
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border border-lab-700/70 bg-lab-900/60 p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 ${tone.ring}`}
            >
              <span
                aria-hidden
                className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl transition-opacity duration-300 ${tone.glow} opacity-0 group-hover:opacity-100`}
              />

              <span className="flex items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-mono text-sm font-semibold ${tone.chip}`}>
                  {LETTERS[i]}
                </span>
                <span className="min-w-0">
                  <span className={`flex items-center gap-1.5 text-base font-semibold ${tone.accent}`}>
                    <Icon size={15} />
                    {track.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] uppercase tracking-wider text-slate-500">{track.tagline}</span>
                </span>
                <span className="ml-auto shrink-0 rounded-full border border-lab-700 px-2 py-0.5 font-mono text-[10px] text-slate-500">
                  {track.items.length}
                </span>
              </span>

              <p className="mt-3.5 text-sm leading-relaxed text-slate-400">{track.blurb}</p>

              <ul className="mt-3.5 space-y-1">
                {track.teaches.map((t) => (
                  <li key={t} className="flex gap-1.5 text-[11px] leading-relaxed text-slate-500">
                    <Check size={11} className={`mt-0.5 shrink-0 ${tone.accent}`} />
                    {t}
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap content-start gap-1.5 border-t border-lab-700/70 pt-3">
                {track.items.map((a) => (
                  <span key={a.id} className="rounded-md bg-lab-850 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {a.name}
                  </span>
                ))}
              </div>

              <span className={`mt-auto flex items-center gap-1 pt-3.5 text-xs font-medium ${tone.accent}`}>
                Open {track.label.toLowerCase()}
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
