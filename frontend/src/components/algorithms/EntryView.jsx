import { Suspense } from 'react'
import { ArrowRight, BookOpen, Box, FlaskConical, Lightbulb, Scale, Sparkles, TriangleAlert, Users, Workflow } from 'lucide-react'

import { Panel } from '../bloch/ui'
import { Badge, Cost } from './bits'
import Flowchart from './Flowchart'
import { LABS } from './labs'
import { COLUMNS } from './library'
import StepDebugger from './StepDebugger'

export const TABS = [
  { id: 'overview', label: 'Explained', icon: BookOpen, has: () => true },
  { id: 'lab', label: 'Interactive lab', icon: FlaskConical, has: (e) => Boolean(e.lab) },
  { id: 'circuit', label: 'Circuit debugger', icon: Box, has: (e) => Boolean(e.build) },
]

/**
 * One library entry, in three layers of depth: what it is and how it flows
 * (Explained), a hands-on simulation of the whole protocol or algorithm
 * (Lab), and the gate-by-gate quantum circuit (Circuit). Entries that are not
 * gate circuits -- photonic boson sampling, CV-QKD -- simply have no third tab.
 */
export default function EntryView({ entry, params, onParamChange, tab, onTab }) {
  const tabs = TABS.filter((t) => t.has(entry))
  const active = tabs.some((t) => t.id === tab) ? tab : 'overview'
  const Lab = entry.lab ? LABS[entry.lab] : null

  return (
    <div className="space-y-5">
      <section className="panel px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">{entry.name}</h2>
          <Badge>{entry.level}</Badge>
          <Badge tone="violet">{entry.category}</Badge>
          <Badge tone="green">{entry.speedup}</Badge>
        </div>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400">{entry.summary}</p>
        {entry.delivers && (
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed">
            <span className="mt-px shrink-0 font-semibold uppercase tracking-wider text-signal-violet">Delivers</span>
            <span className="text-slate-400">{entry.delivers}</span>
          </p>
        )}
        <dl className="mt-3 grid gap-2 border-t border-lab-700/70 pt-3 sm:grid-cols-3">
          {COLUMNS[entry.track].map((col) => (
            <div key={col.key} className="rounded-lg bg-lab-850 px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{col.label}</dt>
              <dd className="mt-0.5 text-xs text-slate-200">{entry.dir[col.key]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div role="tablist" aria-label="Depth" className="flex flex-wrap gap-2">
        {tabs.map((t, i) => {
          const on = t.id === active
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                on ? 'border-signal-cyan/50 bg-signal-cyan/15 text-signal-cyan' : 'border-lab-700 bg-lab-900/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="font-mono text-[10px] opacity-70">{i + 1}</span>
              <t.icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      {active === 'overview' && <Overview entry={entry} tabs={tabs} onTab={onTab} />}

      {active === 'lab' && Lab && (
        <Suspense fallback={<div className="panel px-5 py-10 text-center text-xs text-slate-500">Loading the lab…</div>}>
          <Lab key={entry.id} entry={entry} />
        </Suspense>
      )}

      {active === 'circuit' && entry.build && <StepDebugger key={entry.id} algorithm={entry} params={params} onParamChange={onParamChange} />}
    </div>
  )
}

function Overview({ entry, tabs, onTab }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-12">
      <div className="space-y-5 xl:col-span-7">
        <Panel title="How it works, step by step" icon={Workflow}>
          <Flowchart steps={entry.flow} lanes={entry.lanes} />
        </Panel>
        <div className="flex flex-wrap gap-2">
          {tabs
            .filter((t) => t.id !== 'overview')
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTab(t.id)}
                className="group flex items-center gap-2 rounded-xl border border-signal-cyan/30 bg-signal-cyan/5 px-4 py-2.5 text-sm font-medium text-signal-cyan hover:bg-signal-cyan/10"
              >
                <t.icon size={15} />
                {t.id === 'lab' ? 'Try the interactive lab' : 'Step through the quantum circuit'}
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
        </div>
      </div>

      <div className="space-y-4 xl:col-span-5">
        <section className="rounded-xl border border-signal-cyan/25 bg-signal-cyan/5 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-signal-cyan">
            <Sparkles size={12} /> The key idea
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{entry.keyIdea}</p>
        </section>

        <section className="rounded-xl border border-signal-amber/25 bg-signal-amber/5 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-signal-amber">
            <Lightbulb size={12} /> In plain words
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{entry.analogy}</p>
        </section>

        {entry.parties && (
          <Panel title="Who holds what" icon={Users}>
            <ol className="space-y-1.5">
              {entry.parties.map((p) => (
                <li key={p.qubit} className="flex items-baseline gap-2 text-[11px]">
                  <span className="w-14 shrink-0 font-mono text-slate-300">{p.qubit}</span>
                  <span className="w-20 shrink-0 font-medium text-signal-violet">{p.who}</span>
                  <span className="text-slate-500">{p.role}</span>
                </li>
              ))}
            </ol>
          </Panel>
        )}

        {entry.cost && (
          <Panel title="Resource ledger" icon={Scale}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Cost value={entry.cost.ebits} label="ebits" tone="violet" />
              <Cost value={entry.cost.qubitsSent} label="qubits sent" />
              <Cost value={entry.cost.classicalBits} label="classical bits" />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{entry.cost.note}</p>
          </Panel>
        )}

        {entry.queries && (
          <Panel title="Queries needed" icon={Scale}>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-lab-850 py-2">
                <p className="font-mono text-lg text-slate-300">{entry.queries.classical}</p>
                <p className="text-[10px] text-slate-500">classical</p>
              </div>
              <div className="rounded-lg bg-signal-cyan/10 py-2">
                <p className="font-mono text-lg text-signal-cyan">{entry.queries.quantum}</p>
                <p className="text-[10px] text-slate-500">quantum</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">{entry.queries.note}</p>
          </Panel>
        )}

        {entry.limits && (
          <section className="rounded-xl border border-lab-700 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <TriangleAlert size={12} /> Fine print — what this demo simplifies
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{entry.limits}</p>
          </section>
        )}
      </div>
    </div>
  )
}
