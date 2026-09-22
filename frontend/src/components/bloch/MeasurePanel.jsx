import { useState } from 'react'
import { Dices } from 'lucide-react'

import { KET, p0 } from '../../quantum/bloch'
import { Button, Panel, Tabs } from './ui'

/**
 * Two kinds of measurement, because they teach different things: one shot
 * collapses the state (watch the arrow snap to a pole), many shots on fresh
 * copies reveal the probabilities without disturbing the lab's qubit.
 */
export default function MeasurePanel({ vec, onCollapse, disabled }) {
  const [shots, setShots] = useState(1000)
  const [counts, setCounts] = useState(null)
  const [last, setLast] = useState(null)
  const prob0 = p0(vec)

  const sample = () => {
    let zeros = 0
    for (let i = 0; i < shots; i++) if (Math.random() < prob0) zeros++
    setCounts({ 0: zeros, 1: shots - zeros, shots, prob0 })
  }

  const collapse = () => {
    const outcome = Math.random() < prob0 ? 0 : 1
    setLast({ outcome, prob: outcome === 0 ? prob0 : 1 - prob0 })
    onCollapse(`M→${outcome}`, outcome === 0 ? KET.zero : KET.one)
  }

  return (
    <Panel title="Measure" icon={Dices}>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] leading-relaxed text-slate-400">One shot on this qubit — it collapses.</p>
            <Button variant="primary" onClick={collapse} disabled={disabled}>
              Measure
            </Button>
          </div>
          {last && (
            <p className="mt-2 animate-fade-in font-mono text-[11px] text-slate-300">
              Got <span className={last.outcome ? 'text-signal-violet' : 'text-signal-cyan'}>|{last.outcome}⟩</span>{' '}
              (had {(last.prob * 100).toFixed(1)}% chance) — the superposition is gone.
            </p>
          )}
        </div>

        <div className="border-t border-lab-700/70 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs
              value={String(shots)}
              onChange={(v) => setShots(Number(v))}
              tabs={[10, 100, 1000, 10000].map((n) => ({ value: String(n), label: `${n}` }))}
            />
            <Button onClick={sample}>Sample copies</Button>
          </div>
          {counts && (
            <div className="mt-3 space-y-2">
              {[0, 1].map((k) => {
                const frac = counts[k] / counts.shots
                const expected = k === 0 ? counts.prob0 : 1 - counts.prob0
                return (
                  <div key={k} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="w-6 text-slate-400">|{k}⟩</span>
                    <div className="relative h-4 flex-1 overflow-hidden rounded bg-lab-800">
                      <div
                        className={`h-full ${k ? 'bg-signal-violet/70' : 'bg-signal-cyan/70'} transition-[width] duration-300`}
                        style={{ width: `${frac * 100}%` }}
                      />
                      <div className="absolute inset-y-0 w-px bg-slate-200" style={{ left: `${expected * 100}%` }} title="Expected" />
                    </div>
                    <span className="w-20 text-right text-slate-300">
                      {counts[k]} <span className="text-slate-500">/ {counts.shots}</span>
                    </span>
                  </div>
                )
              })}
              <p className="text-[10px] text-slate-500">
                White tick = the Born-rule prediction. Fewer shots → noisier; the lab qubit is untouched.
              </p>
            </div>
          )}
        </div>
      </div>
    </Panel>
  )
}
