import { useMemo, useState } from 'react'

import { range } from '../../../quantum/numeric'
import { coinFlipRun, coinFlipSurvival, KITAEV_BIAS, secretSharingRun, wiesnerAttempt, wiesnerPass } from '../../../quantum/labs/crypto'
import { Slider, Tabs } from '../../bloch/ui'
import { LabSection, LineChartBox, Note, pct, SeedControl, Stat, Stats } from './kit'

const pm = (m) => (m > 0 ? '+1' : '−1')

export function SecretSharingLab() {
  const [seed, setSeed] = useState(1)
  const run = useMemo(() => secretSharingRun({ n: 400, seed }), [seed])
  const bobAlone = run.rounds.filter((r) => r.valid && r.mB === r.mA).length / Math.max(1, run.valid)
  return (
    <div className="space-y-4">
      <LabSection title="Share 400 GHZ triples" aside={<SeedControl seed={seed} onSeed={setSeed} />}>
        <Stats>
          <Stat label="Usable rounds" value={`${run.valid} (${pct(run.valid / 400, 0)})`} hint="Even number of Y’s" />
          <Stat label="Bob + Charlie recover Alice" value={pct(run.correct / Math.max(1, run.valid))} tone="green" />
          <Stat label="Bob alone guesses right" value={pct(bobAlone)} tone="rose" hint="Just his own result as a guess" />
          <Stat label="Charlie alone" value="≈ 50%" tone="rose" />
        </Stats>
        <Note tone="green">Together they are always right; alone each is a coin flip. Neither shareholder can cheat the other out of the secret.</Note>
      </LabSection>
      <LabSection title="First 14 rounds">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-center font-mono text-[11px]">
            <thead>
              <tr className="text-[10px] uppercase text-slate-500">
                {['#', 'Bases A B C', 'Alice', 'Bob', 'Charlie', 'Usable', 'Bob·Charlie ⇒ Alice'].map((h) => (
                  <th key={h} className="px-1 py-1 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {run.rounds.slice(0, 14).map((r, i) => (
                <tr key={i} className="border-t border-lab-700/60 text-slate-300">
                  <td>{i + 1}</td>
                  <td className="text-signal-violet">{r.bases.split('').join(' ')}</td>
                  <td>{pm(r.mA)}</td>
                  <td>{pm(r.mB)}</td>
                  <td>{pm(r.mC)}</td>
                  <td>{r.valid ? <span className="text-signal-green">✓</span> : <span className="text-slate-600">discard</span>}</td>
                  <td>{r.valid ? <span className={r.recovered === r.mA ? 'text-signal-green' : 'text-signal-rose'}>{pm(r.recovered)}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-500">Rule: XXX ⇒ m_A = m_B·m_C;  XYY, YXY, YYX ⇒ m_A = −m_B·m_C.</p>
      </LabSection>
    </div>
  )
}

export function CoinFlipLab() {
  const [k, setK] = useState(8)
  const [cheat, setCheat] = useState('honest')
  const [seed, setSeed] = useState(1)
  const run = useMemo(() => coinFlipRun({ k, cheat: cheat === 'cheat', seed }), [k, cheat, seed])
  const sim = useMemo(() => {
    let survived = 0
    for (let s = 1; s <= 2000; s++) survived += coinFlipRun({ k, cheat: true, seed: 10000 + s }).caught ? 0 : 1
    return survived / 2000
  }, [k])
  const curve = range(16).map((i) => ({ k: i + 1, theory: coinFlipSurvival(i + 1) }))
  return (
    <div className="space-y-4">
      <LabSection title="One coin flip" aside={<SeedControl seed={seed} onSeed={setSeed} />}>
        <div className="grid gap-4 md:grid-cols-2">
          <Slider label="Qubits Alice sends (k)" unit="" value={k} min={1} max={16} step={1} onChange={setK} />
          <div>
            <p className="mb-1 text-[11px] text-slate-400">Alice plays</p>
            <Tabs value={cheat} onChange={setCheat} tabs={[{ value: 'honest', label: 'honestly' }, { value: 'cheat', label: 'cheats (lies about basis)' }]} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-center font-mono text-[11px]">
            <tbody>
              {[
                ['Alice’s value', run.values],
                ['Bob’s basis', run.bobBases.map((b) => (b ? 'X' : 'Z'))],
                ['Bob’s result', run.bobResults],
                ['Checked?', run.bobBases.map((b) => (b === run.claimed ? '✓' : ''))],
              ].map(([label, cells]) => (
                <tr key={label} className="border-t border-lab-700/60">
                  <td className="px-2 py-1 text-left text-[10px] text-slate-500">{label}</td>
                  {cells.map((c, i) => (
                    <td key={i} className={`px-1 ${label === 'Checked?' ? 'text-signal-violet' : 'text-slate-300'}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Stats>
          <Stat label="Alice’s real coin c" value={`${run.c} (${run.c ? 'X' : 'Z'})`} />
          <Stat label="Bob’s guess g" value={run.guess} />
          <Stat label="Alice claims" value={`${run.claimed} (${run.claimed ? 'X' : 'Z'})`} tone={run.claimed !== run.c ? 'rose' : 'slate'} />
          <Stat label="Outcome c ⊕ g" value={run.caught ? 'caught!' : run.outcome} tone={run.caught ? 'rose' : 'cyan'} />
        </Stats>
      </LabSection>
      <LabSection title="How often does a cheating Alice get away with it?">
        <LineChartBox data={curve} x="k" yLog yDomain={[1e-3, 1]} xLabel="qubits k" yLabel="P(not caught)" series={[{ key: 'theory', label: '(3/4)ᵏ' }]} dots={[{ x: k, y: sim }]} />
        <p className="text-xs text-slate-400">Amber dot: 2 000 simulated cheating attempts at k = {k} — survived {pct(sim)} (theory {pct(coinFlipSurvival(k))}).</p>
        <Note tone="amber">
          Fine print: an Alice who sends halves of entangled pairs can postpone her basis choice and cheat perfectly — this simple scheme is insecure. Kitaev proved every strong quantum coin flip leaves some cheater a bias of at least 1/√2 − ½ ≈ {KITAEV_BIAS.toFixed(3)}; weak coin flipping (each side wants a different result) can be made arbitrarily fair.
        </Note>
      </LabSection>
    </div>
  )
}

export function WiesnerLab() {
  const [n, setN] = useState(10)
  const [seed, setSeed] = useState(1)
  const attempt = useMemo(() => wiesnerAttempt({ n, seed }), [n, seed])
  const sim = useMemo(() => {
    let pass = 0
    for (let s = 1; s <= 4000; s++) pass += wiesnerAttempt({ n, seed: 5000 + s }).pass ? 1 : 0
    return pass / 4000
  }, [n])
  const curve = range(30).map((i) => ({ n: i + 1, p: wiesnerPass(i + 1) }))
  const S = { Z: ['|0⟩', '|1⟩'], X: ['|+⟩', '|−⟩'] }
  return (
    <div className="space-y-4">
      <LabSection title="A forger copies one note" aside={<SeedControl seed={seed} onSeed={setSeed} />}>
        <Slider label="Qubits on the note (n)" unit="" value={n} min={1} max={20} step={1} onChange={setN} />
        <div className="flex flex-wrap gap-1.5">
          {attempt.qubits.map((q, i) => (
            <div key={i} className={`rounded-lg border px-2 py-1 text-center font-mono text-[10px] ${q.pass ? 'border-signal-green/40 text-signal-green' : 'border-signal-rose/50 text-signal-rose'}`}>
              <div className="text-slate-300">{S[q.basis][q.bit]}</div>
              <div className="text-slate-500">guess {q.guess}</div>
              <div>{q.pass ? 'pass' : 'FAIL'}</div>
            </div>
          ))}
        </div>
        <Note tone={attempt.pass ? 'amber' : 'green'}>{attempt.pass ? 'This forgery slipped through — possible, but rare for large n.' : 'The bank caught this forgery: at least one qubit failed verification.'}</Note>
      </LabSection>
      <LabSection title="Forgery success shrinks exponentially">
        <LineChartBox data={curve} x="n" yLog yDomain={[1e-4, 1]} xLabel="qubits per note" yLabel="P(forgery passes)" series={[{ key: 'p', label: '(3/4)ⁿ' }]} dots={[{ x: n, y: Math.max(sim, 1e-4) }]} />
        <p className="text-xs text-slate-400">
          4 000 simulated forgeries of an {n}-qubit note: {pct(sim, 2)} passed (theory {pct(wiesnerPass(n), 2)}). A 50-qubit note would pass about once in 1.8 million tries.
        </p>
      </LabSection>
    </div>
  )
}
