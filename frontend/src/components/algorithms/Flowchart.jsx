import { useEffect, useMemo, useState } from 'react'
import { Atom, Cpu, GitBranch, Pause, Play, Repeat, ScanLine, SkipForward } from 'lucide-react'

/**
 * A step-by-step flowchart drawn as a swimlane (sequence) diagram.
 *
 * Each lane is a party or a machine -- Alice, Eve, Bob; or "Quantum computer"
 * and "Classical computer" for hybrid algorithms -- so who does what, and what
 * crosses between them, is visible at a glance. An arrow between lanes is
 * labelled by what travels: qubits (cyan, solid) or classical bits (amber,
 * dashed). "Play" walks through the steps one at a time with a caption, like
 * a short narrated animation.
 */

const KIND = {
  quantum: { icon: Atom, label: 'Quantum step', ring: 'border-signal-cyan/50', text: 'text-signal-cyan', bg: 'bg-signal-cyan/5' },
  classical: { icon: Cpu, label: 'Classical step', ring: 'border-signal-amber/50', text: 'text-signal-amber', bg: 'bg-signal-amber/5' },
  measure: { icon: ScanLine, label: 'Measurement', ring: 'border-signal-violet/50', text: 'text-signal-violet', bg: 'bg-signal-violet/5' },
  decision: { icon: GitBranch, label: 'Decision / check', ring: 'border-signal-rose/50', text: 'text-signal-rose', bg: 'bg-signal-rose/5' },
}

const VIA = {
  quantum: { label: 'qubit', line: 'border-signal-cyan', text: 'text-signal-cyan', dash: 'border-solid' },
  classical: { label: 'bits', line: 'border-signal-amber', text: 'text-signal-amber', dash: 'border-dashed' },
}

function Card({ step, index, active, onClick, lane }) {
  const k = KIND[step.kind] ?? KIND.quantum
  const Icon = k.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-xl border px-3 py-2 text-left transition-all ${k.ring} ${k.bg} ${
        active ? 'scale-[1.02] shadow-lg ring-2 ring-signal-cyan/40' : 'hover:border-slate-400/60'
      } ${step.kind === 'decision' ? 'border-dashed' : ''}`}
    >
      <span className="flex items-start gap-2">
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[10px] ${k.text} bg-lab-900/80`}>{index + 1}</span>
        <span className="min-w-0">
          {lane && <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-500">{lane}</span>}
          <span className="flex items-center gap-1 text-[12px] font-semibold leading-snug text-slate-200">
            <Icon size={12} className={`shrink-0 ${k.text}`} />
            {step.title}
          </span>
          {step.text && <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{step.text}</span>}
          {step.loop && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-lab-700 px-1.5 py-px font-mono text-[9px] text-slate-500">
              <Repeat size={9} /> {step.loop}
            </span>
          )}
        </span>
      </span>
    </button>
  )
}

/** Horizontal arrow across lanes, labelled by what travels. */
function Crossing({ from, to, via, lanes }) {
  const v = VIA[via] ?? VIA.classical
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const right = to > from
  const inset = `${50 / (hi - lo + 1)}%` // centre of the first and last spanned lane
  return (
    <div className="relative flex h-6 items-center" style={{ gridColumn: `${lo + 1} / ${hi + 2}` }}>
      <div className={`absolute border-t-2 ${v.line} ${v.dash}`} style={{ left: inset, right: inset }} />
      <span
        className={`absolute h-0 w-0 border-y-[5px] border-y-transparent ${right ? 'border-l-[8px]' : 'border-r-[8px]'} ${v.text}`}
        style={{ ...(right ? { right: inset, borderLeftColor: 'currentColor' } : { left: inset, borderRightColor: 'currentColor' }) }}
      />
      <span className={`relative mx-auto rounded-full bg-lab-900 px-1.5 font-mono text-[9px] ${v.text}`}>
        {v.label} {right ? '→' : '←'} {lanes[to]}
      </span>
    </div>
  )
}

function Down({ col }) {
  return (
    <div className="flex h-4 justify-center" style={{ gridColumn: `${col + 1} / ${col + 2}` }}>
      <div className="h-full border-l-2 border-lab-600" />
    </div>
  )
}

export default function Flowchart({ steps, lanes: explicitLanes }) {
  const lanes = useMemo(() => explicitLanes ?? [...new Set(steps.map((s) => s.lane ?? 'Process'))], [steps, explicitLanes])
  const laneIndex = (s) => Math.max(0, lanes.indexOf(s.lane ?? 'Process'))
  const [active, setActive] = useState(-1)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return undefined
    const id = window.setTimeout(() => {
      setActive((a) => {
        if (a >= steps.length - 1) {
          setPlaying(false)
          return a
        }
        return a + 1
      })
    }, active < 0 ? 200 : 2600)
    return () => window.clearTimeout(id)
  }, [playing, active, steps.length])

  const current = active >= 0 ? steps[active] : null
  const multi = lanes.length > 1

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!playing && active >= steps.length - 1) setActive(-1)
            setPlaying((p) => !p)
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-signal-cyan/40 bg-signal-cyan/10 px-2.5 py-1 text-xs font-medium text-signal-cyan hover:bg-signal-cyan/20"
        >
          {playing ? <Pause size={12} /> : <Play size={12} />} {playing ? 'Pause' : 'Play walkthrough'}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false)
            setActive((a) => (a + 1) % steps.length)
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-lab-700 px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
        >
          <SkipForward size={12} /> Next step
        </button>
        <div className="ml-auto flex flex-wrap gap-2 text-[10px] text-slate-500">
          {Object.entries(KIND).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <v.icon size={11} className={v.text} /> {v.label}
            </span>
          ))}
          {multi && (
            <>
              <span className="flex items-center gap-1">
                <span className="w-4 border-t-2 border-signal-cyan" /> qubit sent
              </span>
              <span className="flex items-center gap-1">
                <span className="w-4 border-t-2 border-dashed border-signal-amber" /> classical bits sent
              </span>
            </>
          )}
        </div>
      </div>

      {current && (
        <div className="mb-3 rounded-xl border border-signal-cyan/30 bg-signal-cyan/5 px-4 py-2.5 animate-fade-in" key={active}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-signal-cyan">
            Step {active + 1} of {steps.length}
            {multi && ` · ${current.lane}`}
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-100">{current.title}</p>
          {current.text && <p className="text-xs leading-relaxed text-slate-400">{current.text}</p>}
        </div>
      )}

      {/* Wide screens: lanes side by side. */}
      <div className={multi ? 'hidden sm:block' : ''}>
        <div className="grid gap-x-3" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}>
          {multi &&
            lanes.map((l) => (
              <div key={l} className="mb-1 rounded-md border border-lab-700/70 bg-lab-850 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {l}
              </div>
            ))}
          {steps.map((s, i) => {
            const col = laneIndex(s)
            const prev = i > 0 ? laneIndex(steps[i - 1]) : col
            return [
              i > 0 && (prev === col ? <Down key={`d${i}`} col={col} /> : <Crossing key={`c${i}`} from={prev} to={col} via={s.via} lanes={lanes} />),
              <div key={`s${i}`} style={{ gridColumn: `${col + 1} / ${col + 2}` }}>
                <Card step={s} index={i} active={i === active} onClick={() => (setPlaying(false), setActive(i))} />
              </div>,
            ]
          })}
        </div>
      </div>

      {/* Narrow screens: one column, lane named on each card. */}
      {multi && (
        <ol className="space-y-2 sm:hidden">
          {steps.map((s, i) => (
            <li key={i}>
              <Card step={s} index={i} lane={s.lane} active={i === active} onClick={() => (setPlaying(false), setActive(i))} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
