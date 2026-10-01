import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Box,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  Users,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Sigma,
  Timer,
} from 'lucide-react'

import { useAlgorithmPlayer } from '../../hooks/useAlgorithmPlayer'
import { marginal } from '../../quantum/run'
import { Panel, Tabs } from '../bloch/ui'
import AmplitudeBars, { PhaseWheel } from './AmplitudeBars'
import CircuitStrip from './CircuitStrip'
import QubitSpheres from './QubitSpheres'

const SPEEDS = [0.5, 1, 2]

/**
 * An algorithm as a debugger session: a circuit with a playhead, the full
 * statevector, every qubit's own sphere, and a plain-English account of the
 * step that just ran.
 */
export default function StepDebugger({ algorithm, params, onParamChange }) {
  const player = useAlgorithmPlayer(algorithm, params)
  const { built, state, step, last, playing } = player
  const [showMath, setShowMath] = useState(false)
  const current = step > 0 ? built.steps[step - 1] : null
  const finished = step === last

  // ← / → step, space plays -- unless the user is typing in a control.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, select, textarea, [contenteditable]')) return
      if (e.key === ' ' && e.target.closest?.('button')) return // the button handles its own space
      if (e.key === 'ArrowRight') player.next()
      else if (e.key === 'ArrowLeft') player.prev()
      else if (e.key === ' ') {
        e.preventDefault()
        player.toggle()
      } else return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [player])

  const outcomes = useMemo(() => {
    const dist = marginal(state, built.readout)
    return Object.entries(dist)
      .filter(([, p]) => p > 0.0005)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [state, built.readout])

  return (
    <div className="space-y-5">
      {/* --- header: what, why, and the knobs -------------------------------- */}
      <section className="panel px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-slate-100">{algorithm.name}</h2>
              <Badge>{algorithm.level}</Badge>
              <Badge tone="violet">{algorithm.category}</Badge>
              <Badge tone="green">{algorithm.speedup}</Badge>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{algorithm.summary}</p>
            {algorithm.delivers && (
              <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-signal-violet">
                <span className="mt-px shrink-0 font-semibold uppercase tracking-wider">Delivers</span>
                <span className="text-slate-400">{algorithm.delivers}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {algorithm.params.map((p) => (
              <label key={p.key} className="block text-[11px] text-slate-500">
                {p.label}
                <select
                  value={params[p.key]}
                  onChange={(e) => onParamChange(p.key, e.target.value)}
                  className="mt-1 block w-full min-w-[9rem] rounded-lg border border-lab-700 bg-lab-850 px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:border-signal-cyan/60 focus:outline-none"
                >
                  {p.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* --- circuit + transport ---------------------------------------------- */}
      <Panel
        title="Circuit"
        icon={Box}
        bodyClassName="px-3 pb-3 pt-2"
        actions={<span className="font-mono text-[10px] text-slate-500">← → to step · space to play · click a step to jump</span>}
      >
        <CircuitStrip built={built} step={step} onSeek={player.seek} />
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-lab-700/70 pt-3">
          <div className="flex items-center gap-1">
            <Transport label="Rewind" icon={SkipBack} onClick={() => player.seek(0)} disabled={step === 0} />
            <Transport label="Previous step" icon={ChevronLeft} onClick={player.prev} disabled={step === 0} />
            <button
              type="button"
              onClick={player.toggle}
              aria-label={playing ? 'Pause' : 'Play'}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-signal-cyan/40 bg-signal-cyan/15 text-signal-cyan transition-colors hover:bg-signal-cyan/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60"
            >
              {playing ? <Pause size={15} /> : <Play size={15} className="translate-x-px" />}
            </button>
            <Transport label="Next step" icon={ChevronRight} onClick={player.next} disabled={finished} />
            <Transport label="Jump to end" icon={SkipForward} onClick={() => player.seek(last)} disabled={finished} />
          </div>
          <input
            type="range"
            min={0}
            max={last}
            value={step}
            onChange={(e) => player.seek(Number(e.target.value))}
            aria-label="Scrub through steps"
            className="min-w-[8rem] flex-1 accent-[rgb(var(--signal-amber))]"
          />
          <span className="font-mono text-[11px] text-slate-400">
            step {step}/{last}
          </span>
          <div className="flex items-center gap-1.5">
            <Timer size={12} className="text-slate-500" />
            <Tabs value={String(player.speed)} onChange={(v) => player.setSpeed(Number(v))} tabs={SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))} />
          </div>
        </div>
      </Panel>

      {/* --- what just happened ----------------------------------------------- */}
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-7">
          <Panel
            title={current ? `Step ${step} · ${current.title}` : 'Before the first gate'}
            icon={MessageSquareText}
            actions={
              current?.math && (
                <button
                  type="button"
                  onClick={() => setShowMath((m) => !m)}
                  className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${showMath ? 'bg-signal-violet/15 text-signal-violet' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  <Sigma size={11} /> {showMath ? 'Hide math' : 'Show math'}
                </button>
              )
            }
          >
            <div key={step} className="animate-fade-in">
              <p className="text-sm leading-relaxed text-slate-300">
                {current
                  ? current.narration
                  : `Every qubit starts in |0⟩, so the register is |${'0'.repeat(built.qubits)}⟩ — one tall bar. Press play, or step with →, and watch how each gate reshapes the bars and the spheres.`}
              </p>
              {showMath && current?.math && (
                <p className="mt-3 rounded-lg border border-signal-violet/20 bg-signal-violet/5 px-3 py-2 font-mono text-xs text-signal-violet">{current.math}</p>
              )}
            </div>
          </Panel>

          <Panel
            title="Statevector"
            icon={BarChart3}
            actions={
              <span className="flex items-center gap-2 text-[10px] text-slate-500">
                height = |amplitude| · colour = phase <PhaseWheel size={16} />
              </span>
            }
          >
            <AmplitudeBars state={state} />
            <p className="mt-2 text-[10px] text-slate-500">
              Bitstrings read {[...built.labels].reverse().join(' ')} (Qiskit order). Hover a bar for its exact amplitude.
            </p>
          </Panel>
        </div>

        <div className="space-y-5 xl:col-span-5">
          {algorithm.parties && (
            <Panel title="Who holds what" icon={Users}>
              <ol className="space-y-1.5">
                {algorithm.parties.map((p) => (
                  <li key={p.qubit} className="flex items-baseline gap-2 text-[11px]">
                    <span className="w-12 shrink-0 font-mono text-slate-300">{p.qubit}</span>
                    <span className="w-12 shrink-0 font-medium text-signal-violet">{p.who}</span>
                    <span className="text-slate-500">{p.role}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2.5 border-t border-lab-700/70 pt-2 text-[10px] leading-relaxed text-slate-500">
                Alice and Bob are far apart. Only gates on a party&rsquo;s own qubits are things that party can really do.
              </p>
            </Panel>
          )}

          <Panel title="Each qubit on its own" icon={CircleDot} bodyClassName="p-3">
            <QubitSpheres state={state} labels={built.labels} target={built.target} />
            <p className="mt-2 px-1 text-[10px] leading-relaxed text-slate-500">
              A violet, shortened arrow means the qubit is entangled: it has no state of its own.
              {built.target && ' The amber ghost is where teleportation must deliver the message.'}
            </p>
          </Panel>

          <Panel title="Readout" icon={ListChecks}>
            <div className="space-y-1.5">
              {outcomes.map(([bits, p]) => (
                <div key={bits} className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="w-12 text-slate-300">{bits}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-lab-800">
                    <div className="h-full rounded-full bg-signal-cyan/70 transition-[width] duration-500" style={{ width: `${p * 100}%` }} />
                  </div>
                  <span className="w-12 text-right text-slate-400">{(p * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <p className={`mt-3 text-xs ${finished ? 'text-signal-green' : 'text-slate-500'}`}>
              {finished ? '✓ ' : 'At the end: '}
              {built.answer.text}
            </p>
            {algorithm.cost && (
              <div className="mt-3 border-t border-lab-700/70 pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Resource ledger</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Cost value={algorithm.cost.ebits} label="ebits" tone="violet" />
                  <Cost value={algorithm.cost.qubitsSent} label="qubits sent" />
                  <Cost value={algorithm.cost.classicalBits} label="classical bits" />
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-600">{algorithm.cost.note}</p>
              </div>
            )}
            {algorithm.queries && (
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-lab-700/70 pt-3 text-center">
                <div className="rounded-lg bg-lab-850 py-2">
                  <p className="font-mono text-lg text-slate-300">{algorithm.queries.classical}</p>
                  <p className="text-[10px] text-slate-500">classical queries</p>
                </div>
                <div className="rounded-lg bg-signal-cyan/10 py-2">
                  <p className="font-mono text-lg text-signal-cyan">{algorithm.queries.quantum}</p>
                  <p className="text-[10px] text-slate-500">quantum queries</p>
                </div>
                <p className="col-span-2 text-[10px] text-slate-600">{algorithm.queries.note}</p>
              </div>
            )}
          </Panel>

          <section className="rounded-xl border border-signal-amber/25 bg-signal-amber/5 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-signal-amber">
              <Lightbulb size={12} /> In plain words
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{algorithm.analogy}</p>
          </section>
        </div>
      </div>
    </div>
  )
}

function Transport({ label, icon: Icon, onClick, disabled }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md p-1.5 text-slate-400 transition-colors hover:text-slate-100 disabled:opacity-30"
    >
      <Icon size={16} />
    </button>
  )
}

function Cost({ value, label, tone }) {
  const zero = value === 0
  return (
    <div className={`rounded-lg py-2 ${tone === 'violet' ? 'bg-signal-violet/10' : 'bg-lab-850'}`}>
      <p className={`font-mono text-lg ${zero ? 'text-slate-600' : tone === 'violet' ? 'text-signal-violet' : 'text-slate-300'}`}>{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  )
}

function Badge({ children, tone = 'cyan' }) {
  const styles = {
    cyan: 'border-signal-cyan/30 text-signal-cyan',
    violet: 'border-signal-violet/30 text-signal-violet',
    green: 'border-signal-green/30 text-signal-green',
  }
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[tone]}`}>{children}</span>
}
