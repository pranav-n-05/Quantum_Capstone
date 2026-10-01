import { useMemo, useState } from 'react'

import { gcd, modInverse, modPow, nullSpace2, order, range, rank2, rng, sample } from '../../../quantum/numeric'
import { shorPostProcess } from '../../../quantum/labs/shor'
import { marginal, runSteps } from '../../../quantum/run'
import { useThemeColors } from '../../../hooks/useThemeColors'
import { Slider, Tabs } from '../../bloch/ui'
import hhl from '../library/hhl'
import quantumCounting, { countingEstimate } from '../library/quantumCounting'
import shor from '../library/shor'
import shorDlog from '../library/shorDlog'
import simon from '../library/simon'
import { BarChartBox, LabSection, LineChartBox, Note, pct, SeedControl, Stat, Stats } from './kit'

const runDist = (entry, params) => {
  const built = entry.build(params)
  return marginal(runSteps(built.qubits, built.steps).at(-1), built.readout)
}

// --- Shor ---------------------------------------------------------------------------

export function ShorLab() {
  const [a, setA] = useState('7')
  // Open on a run that factors: m = 0 is a legitimate outcome, but a poor first impression.
  const [seed, setSeed] = useState(() => {
    const d = runDist(shor, { a: '7' })
    for (let k = 1; k < 50; k++) if (shorPostProcess(parseInt(sample(rng(k), d), 2), 3, 7, 15).ok) return k
    return 1
  })
  const N = 15
  const A = Number(a)
  const dist = useMemo(() => runDist(shor, { a }), [a])
  const table = range(9).map((x) => ({ x: String(x), value: modPow(A, x, N) }))
  const m = parseInt(sample(rng(seed), dist), 2)
  const post = shorPostProcess(m, 3, A, N)
  const outcomes = range(8).map((v) => ({ m: v.toString(2).padStart(3, '0') + ` (${v})`, p: dist[v.toString(2).padStart(3, '0')] ?? 0 }))
  return (
    <div className="space-y-4">
      <LabSection title="1 · The pattern the quantum part looks for">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-400">a =</span>
          <Tabs value={a} onChange={setA} tabs={[2, 4, 7, 8, 11, 13, 14].map((v) => ({ value: String(v), label: String(v) }))} />
          <span className="font-mono text-[11px] text-slate-500">gcd({A}, 15) = {gcd(A, N)} · period r = {order(A, N)}</span>
        </div>
        <BarChartBox data={table} x="x" xLabel={`x  (bars = ${A}ˣ mod 15)`} series={[{ key: 'value', label: `${A}ˣ mod 15` }]} height={170} />
        <p className="text-xs text-slate-400">The bars repeat every {order(A, N)} steps. Classically, finding that repeat for a 2048-bit N takes longer than the age of the universe; the quantum circuit sees all x at once.</p>
      </LabSection>
      <LabSection title="2 · What the quantum circuit measures">
        <BarChartBox data={outcomes} x="m" series={[{ key: 'p', label: 'probability' }]} height={170} angled />
        <p className="text-xs text-slate-400">Peaks only at multiples of 8/r. Each run gives one of them at random.</p>
      </LabSection>
      <LabSection title="3 · Classical post-processing of one run" aside={<SeedControl seed={seed} onSeed={setSeed} />}>
        <ol className="space-y-1.5 font-mono text-[12px] text-slate-300">
          <li>
            measured m = <span className="text-signal-cyan">{m}</span> → phase m/8 = {post.phase.toFixed(3)}
          </li>
          {post.fractions && (
            <li>
              continued fractions: {post.fractions.map(([p, q]) => `${p}/${q}`).join(' → ')}
            </li>
          )}
          {post.r && (
            <li>
              candidate period r = <span className="text-signal-cyan">{post.r}</span> ({A}^{post.r} mod 15 = {modPow(A, post.r, N)} ✓)
            </li>
          )}
          {post.half !== undefined && (
            <li>
              a^(r/2) mod 15 = {post.half} → gcd({post.half} − 1, 15) = {post.factors[0]}, gcd({post.half} + 1, 15) = {post.factors[1]}
            </li>
          )}
        </ol>
        <Note tone={post.ok ? 'green' : 'amber'}>{post.ok ? `15 = ${post.factors[0]} × ${post.factors[1]}. Factored!` : post.reason}</Note>
      </LabSection>
    </div>
  )
}

// --- Discrete log -------------------------------------------------------------------

export function ShorDlogLab() {
  const c = useThemeColors()
  const [x, setX] = useState('3')
  const X = Number(x)
  const h = modPow(2, X, 5)
  const dist = useMemo(() => runDist(shorDlog, { x }), [x])
  const palette = ['', 'signal-cyan', 'signal-violet', 'signal-amber', 'signal-green']
  return (
    <div className="space-y-4">
      <LabSection title="The function f(a, b) = 2ᵃ · hᵇ mod 5 has stripes">
        <Tabs value={x} onChange={setX} tabs={[1, 2, 3].map((v) => ({ value: String(v), label: `h = ${modPow(2, v, 5)}` }))} />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <svg viewBox="0 0 220 220" className="w-full max-w-[240px]">
              {range(4).map((b) =>
                range(4).map((a) => {
                  const v = (modPow(2, a, 5) * modPow(h, b, 5)) % 5
                  return (
                    <g key={`${a}${b}`}>
                      <rect x={30 + a * 46} y={10 + (3 - b) * 46} width={42} height={42} rx={6} fill={c[palette[v]]} fillOpacity={0.35} stroke={c[palette[v]]} />
                      <text x={51 + a * 46} y={36 + (3 - b) * 46} textAnchor="middle" fontSize={14} fontFamily="ui-monospace, monospace" fill={c['slate-200']}>
                        {v}
                      </text>
                    </g>
                  )
                }),
              )}
              <text x={120} y={214} textAnchor="middle" fontSize={10} fill={c['slate-500']}>a →</text>
              <text x={12} y={110} fontSize={10} fill={c['slate-500']}>b ↑</text>
            </svg>
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <p>Same colour = same value. Values repeat along diagonal stripes a + {X}·b = const (mod 4): the slope of the stripes is the secret x.</p>
            <p>The 2-D inverse QFT turns stripes into dots on the perpendicular line d ≡ {X}·c (mod 4):</p>
            <table className="w-full text-center font-mono text-[11px]">
              <thead>
                <tr className="text-[10px] text-slate-500"><th>c</th><th>d</th><th>P</th><th>x = d·c⁻¹ mod 4</th></tr>
              </thead>
              <tbody>
                {range(4).map((cc) => {
                  const d = (X * cc) % 4
                  const key = d.toString(2).padStart(2, '0') + cc.toString(2).padStart(2, '0')
                  const inv = modInverse(cc, 4)
                  return (
                    <tr key={cc} className="border-t border-lab-700/60 text-slate-300">
                      <td>{cc}</td>
                      <td>{d}</td>
                      <td>{pct(dist[key] ?? 0, 0)}</td>
                      <td>{inv ? <span className="text-signal-green">{(d * inv) % 4} ✓</span> : <span className="text-slate-600">c not invertible — rerun</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <Note tone="green">Half of all runs reveal x = {X} immediately (2^{X} mod 5 = {h} ✓). The same idea on 256-bit elliptic curves breaks today’s key exchanges.</Note>
      </LabSection>
    </div>
  )
}

// --- Simon --------------------------------------------------------------------------

export function SimonLab() {
  const [secret, setSecret] = useState('110')
  const [seed, setSeed] = useState(1)
  const dist = useMemo(() => runDist(simon, { secret }), [secret])
  const rounds = useMemo(() => {
    const rand = rng(seed)
    const ys = []
    const log = []
    while (rank2(ys) < 2 && log.length < 20) {
      const y = parseInt(sample(rand, dist), 2)
      const before = rank2(ys)
      ys.push(y)
      log.push({ y, useful: rank2(ys) > before })
    }
    return { log, solution: nullSpace2(ys, 3) }
  }, [dist, seed])
  return (
    <div className="space-y-4">
      <LabSection title="Collect equations until s is pinned down" aside={<SeedControl seed={seed} onSeed={setSeed} />}>
        <Tabs value={secret} onChange={setSecret} tabs={['110', '101', '011', '111'].map((v) => ({ value: v, label: `s = ${v}` }))} />
        <ol className="space-y-1 font-mono text-[12px]">
          {rounds.log.map((r, i) => (
            <li key={i} className={r.useful ? 'text-slate-200' : 'text-slate-500'}>
              query {i + 1}: y = {r.y.toString(2).padStart(3, '0')} ⇒ {r.y.toString(2).padStart(3, '0')} · s = 0 {r.y === 0 ? '(trivial — no information)' : r.useful ? '— new equation' : '— already implied'}
            </li>
          ))}
        </ol>
        <Stats>
          <Stat label="Quantum queries used" value={rounds.log.length} tone="cyan" />
          <Stat label="Independent equations" value="2 of 2" />
          <Stat label="Solution s" value={rounds.solution.map((s) => s.toString(2).padStart(3, '0')).join(', ')} tone="green" />
          <Stat label="Classical (birthday) search" value="~2^(n/2)" tone="rose" />
        </Stats>
        <Note>Gaussian elimination over GF(2): the only non-zero s with y·s = 0 for every measured y. For n-bit inputs Simon needs O(n) queries; any classical algorithm needs Ω(2^(n/2)).</Note>
      </LabSection>
    </div>
  )
}

// --- HHL -----------------------------------------------------------------------------

export function HhlLab() {
  const [b, setB] = useState('zero')
  const built = hhl.build({ b })
  const final = useMemo(() => runSteps(built.qubits, built.steps).at(-1), [built])
  const dist = marginal(final, built.readout)
  const success = (dist['10'] ?? 0) + (dist['11'] ?? 0)
  const hhl0 = (dist['10'] ?? 0) / success
  const data = [
    { out: 'x₀ (b reads 0)', classical: built.answer.postselected, hhl: hhl0 },
    { out: 'x₁ (b reads 1)', classical: 1 - built.answer.postselected, hhl: 1 - hhl0 },
  ]
  return (
    <div className="space-y-4">
      <LabSection title="Solve A·x = b with A = [[1.5, 0.5], [0.5, 1.5]]">
        <Tabs value={b} onChange={setB} tabs={[{ value: 'zero', label: 'b = (1, 0)' }, { value: 'one', label: 'b = (0, 1)' }, { value: 'plus', label: 'b = (1, 1)/√2' }]} />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-xs text-slate-400">
            <p className="font-mono text-slate-300">eigenvalues λ = 1 (u = |−⟩), λ = 2 (u = |+⟩)</p>
            <p>HHL never inverts A directly. It splits b into the two eigen-directions, divides each part by its own λ, and recombines.</p>
            <p>That is literally x = Σ (βⱼ/λⱼ)·uⱼ — the |+⟩ part is halved, the |−⟩ part kept.</p>
          </div>
          <BarChartBox data={data} x="out" series={[{ key: 'classical', label: 'classical |xᵢ|²/‖x‖²' }, { key: 'hhl', label: 'HHL output (given anc = 1)', color: 'signal-green' }]} yDomain={[0, 1]} height={190} />
        </div>
        <Stats>
          <Stat label="P(anc = 1) — success" value={pct(success)} tone="cyan" hint="Runs with anc = 0 are thrown away" />
          <Stat label="Expected runs per success" value={(1 / success).toFixed(2)} />
          <Stat label="Clock uncomputed" value={pct((marginal(final, [1, 2])['00'] ?? 0), 0)} tone="green" />
          <Stat label="Match classical" value={Math.abs(hhl0 - built.answer.postselected) < 1e-9 ? 'exact ✓' : '✗'} tone="green" />
        </Stats>
        <Note tone="amber">
          Reading out both amplitudes needs many runs — that is tomography and erases the speed-up. HHL pays off when you need one number about x (an expectation value), A is sparse and well-conditioned, and b loads quickly.
        </Note>
      </LabSection>
    </div>
  )
}

// --- Amplitude amplification ---------------------------------------------------------

export function AmpAmpLab() {
  const c = useThemeColors()
  const [thetaDeg, setThetaDeg] = useState(12)
  const [k, setK] = useState(3)
  const theta = (thetaDeg * Math.PI) / 180
  const best = Math.max(0, Math.round(Math.PI / (4 * theta) - 0.5))
  const angle = (2 * k + 1) * theta
  const p = Math.sin(angle) ** 2
  const curve = range(21).map((j) => ({ k: j, p: Math.sin((2 * j + 1) * theta) ** 2 }))
  const R = 90
  const cx = 110
  const cy = 110
  const pt = (a, r = R) => [cx + r * Math.cos(a), cy - r * Math.sin(a)]
  return (
    <div className="space-y-4">
      <LabSection title="Two reflections = one rotation">
        <div className="grid gap-3 md:grid-cols-2">
          <Slider label="Initial success angle θ (p = sin²θ)" value={thetaDeg} min={2} max={45} step={1} onChange={setThetaDeg} />
          <Slider label="Rounds k" unit="" value={k} min={0} max={20} step={1} onChange={setK} />
        </div>
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <svg viewBox="0 0 220 220" className="w-full max-w-[240px]">
            <circle cx={cx} cy={cy} r={R} fill="none" stroke={c['lab-700']} />
            <line x1={cx - R - 6} y1={cy} x2={cx + R + 6} y2={cy} stroke={c['slate-500']} />
            <line x1={cx} y1={cy + R + 6} x2={cx} y2={cy - R - 6} stroke={c['slate-500']} />
            <text x={cx + R + 2} y={cy - 4} fontSize={9} fill={c['slate-400']} textAnchor="end">bad</text>
            <text x={cx + 4} y={cy - R - 2} fontSize={9} fill={c['signal-green']}>good</text>
            {range(Math.min(k, 20) + 1).map((j) => {
              const [x, y] = pt((2 * j + 1) * theta)
              return <circle key={j} cx={x} cy={y} r={2.5} fill={c['signal-violet']} fillOpacity={0.6} />
            })}
            <line x1={cx} y1={cy} x2={pt(theta)[0]} y2={pt(theta)[1]} stroke={c['slate-400']} strokeDasharray="3 3" />
            <line x1={cx} y1={cy} x2={pt(angle)[0]} y2={pt(angle)[1]} stroke={c['signal-cyan']} strokeWidth={3} strokeLinecap="round" />
            <text x={10} y={214} fontSize={9} fill={c['slate-500']}>dashed: start (θ) · cyan: after {k} rounds</text>
          </svg>
          <div className="space-y-2">
            <LineChartBox data={curve} x="k" xLabel="rounds k" yLabel="P(success)" yDomain={[0, 1]} series={[{ key: 'p', label: 'sin²((2k+1)θ)', dots: true }]} dots={[{ x: k, y: p }]} refLines={[{ x: best, label: `optimum k = ${best}`, color: 'signal-green' }]} height={200} />
          </div>
        </div>
        <Stats>
          <Stat label="Start p" value={pct(Math.sin(theta) ** 2)} />
          <Stat label={`After ${k} rounds`} value={pct(p)} tone={p > 0.9 ? 'green' : 'cyan'} />
          <Stat label="Quantum calls ~ π/(4θ)" value={best + 1} tone="cyan" />
          <Stat label="Classical repeats ~ 1/p" value={(1 / Math.sin(theta) ** 2).toFixed(1)} tone="rose" />
        </Stats>
        <Note>Each round turns the state by 2θ. Too many rounds overshoot and the success probability falls again — amplitude amplification is a rotation, not a ratchet.</Note>
      </LabSection>
    </div>
  )
}

// --- Quantum counting -----------------------------------------------------------------

export function CountingLab() {
  const [M, setM] = useState('2')
  const dist = useMemo(() => runDist(quantumCounting, { M }), [M])
  const rows = range(16).map((k) => {
    const key = k.toString(2).padStart(4, '0')
    return { k: String(k), p: dist[key] ?? 0, est: countingEstimate(k) }
  })
  const best = [...rows].sort((a, b) => b.p - a.p)[0]
  return (
    <div className="space-y-4">
      <LabSection title="Phase estimation of the Grover rotation">
        <Tabs value={M} onChange={setM} tabs={['1', '2', '4'].map((v) => ({ value: v, label: `M = ${v} of 8` }))} />
        <BarChartBox data={rows} x="k" xLabel="counting-register outcome k (of 16)" series={[{ key: 'p', label: 'probability' }]} height={190} />
        <div className="overflow-x-auto">
          <table className="w-full text-center font-mono text-[11px]">
            <tbody>
              <tr className="text-slate-500"><td className="pr-2 text-left">k</td>{rows.map((r) => <td key={r.k}>{r.k}</td>)}</tr>
              <tr className="text-slate-300"><td className="pr-2 text-left text-slate-500">8·sin²(πk/16)</td>{rows.map((r) => <td key={r.k} className={r.p > 0.15 ? 'text-signal-cyan' : ''}>{r.est.toFixed(1)}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <Stats>
          <Stat label="Most likely k" value={best.k} tone="cyan" />
          <Stat label="Estimated M" value={best.est.toFixed(2)} />
          <Stat label="Rounded" value={Math.round(best.est)} tone="green" />
          <Stat label="True M" value={M} />
        </Stats>
        <Note>Two mirror-image peaks (k and 16 − k) are the eigenvalues e^{'{±iθ}'} — both give the same count. Each extra counting qubit halves the error, at the price of doubling the Grover calls: ~√N calls for error ~√M, versus ~N classical samples.</Note>
      </LabSection>
    </div>
  )
}

