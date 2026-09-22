import { CheckCircle2, Lightbulb, Target, Trophy, X } from 'lucide-react'

import { fidelity } from '../../quantum/bloch'
import { CHALLENGES } from './challenges'
import { Button, Meter, Panel } from './ui'

export default function ChallengePanel({ active, vec, gatesUsed, solved, onStart, onExit }) {
  if (!active) {
    return (
      <Panel title="Challenges" icon={Target} bodyClassName="p-3">
        <p className="mb-2.5 px-1 text-[11px] text-slate-500">
          Steer the arrow onto the violet ghost within the gate budget. {solved.size}/{CHALLENGES.length} solved.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CHALLENGES.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onStart(c)}
              className="flex items-center gap-2 rounded-lg border border-lab-700 bg-lab-850/60 px-2.5 py-2 text-left transition-colors hover:border-signal-violet/50"
            >
              <span className="font-mono text-[10px] text-slate-600">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-slate-200">{c.title}</span>
                <span className="block font-mono text-[10px] text-slate-500">
                  → {c.targetLabel} · {c.budget} gate{c.budget > 1 ? 's' : ''}
                </span>
              </span>
              {solved.has(c.id) && <CheckCircle2 size={14} className="shrink-0 text-signal-green" />}
            </button>
          ))}
        </div>
      </Panel>
    )
  }

  const f = fidelity(vec, active.target)
  const success = f >= 0.995 && gatesUsed <= active.budget
  const over = gatesUsed > active.budget

  return (
    <Panel
      title={`Challenge · ${active.title}`}
      icon={Target}
      actions={
        <button type="button" onClick={onExit} className="rounded p-0.5 text-slate-500 hover:text-slate-300" aria-label="Leave challenge">
          <X size={14} />
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-300">
          Reach <span className="font-mono text-signal-violet">{active.targetLabel}</span> in at most{' '}
          <strong className="font-medium">{active.budget}</strong> gate{active.budget > 1 ? 's' : ''}
          {active.allowed && (
            <>
              {' '}using only <span className="font-mono text-slate-400">{active.allowed.join(', ')}</span>
            </>
          )}
          .
        </p>
        <Meter label="Fidelity with target" value={f} tone={success ? 'green' : 'violet'} />
        <p className={`font-mono text-[11px] ${over ? 'text-signal-rose' : 'text-slate-400'}`}>
          gates used {gatesUsed}/{active.budget}
        </p>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
          <Lightbulb size={12} className="mt-0.5 shrink-0 text-signal-amber" /> {active.hint}
        </p>
        {success && (
          <div className="flex animate-fade-in items-center gap-2 rounded-lg border border-signal-green/30 bg-signal-green/10 px-3 py-2 text-xs text-signal-green">
            <Trophy size={14} /> Solved! Fidelity {(f * 100).toFixed(2)}%.
            <Button className="ml-auto" onClick={onExit}>
              Next
            </Button>
          </div>
        )}
        {over && !success && (
          <p className="text-[11px] text-signal-rose">Over budget — undo a step or restart the challenge.</p>
        )}
      </div>
    </Panel>
  )
}
