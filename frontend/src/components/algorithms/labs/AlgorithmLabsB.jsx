import { useEffect, useMemo, useRef, useState } from 'react'

import { cabs2, eigSym, gaussian, range, rng } from '../../../quantum/numeric'
import { bosonDistribution, homCoincidence, randomInterferometer } from '../../../quantum/labs/boson'
import { exactState, infidelity, trotterState, zExpect } from '../../../quantum/labs/hamsim'
import { featureState, makeDataset, qpcaData, qpcaRho, quantumKernel, rbfKernel, svmDecision, trainSvm } from '../../../quantum/labs/ml'
import { BETA_MAX, bestAngles, CHEMICAL_ACCURACY, cutValue, exactGroundEnergy, GAMMA_MAX, GRAPHS, H2_TERMS, maxCut, qaoaLandscape, qaoaState, vqeEnergy } from '../../../quantum/labs/variational'
import { classicalWalk, hadamardWalk, spread } from '../../../quantum/labs/walks'
import { probabilities } from '../../../quantum/statevector'
import { useThemeColors } from '../../../hooks/useThemeColors'
import { Slider, Tabs } from '../../bloch/ui'
import { TRIANGLE_GRAPHS, TRIPLES, isTriangle } from '../library/triangleFinding'
import { BarChartBox, Heatmap, LabSection, LineChartBox, Note, pct, ScatterBox, SeedControl, Stat, Stats } from './kit'

// --- VQE -----------------------------------------------------------------------------

export function VqeLab() {
  const [start, setStart] = useState(0.2)
  const [rate, setRate] = useState(0.4)
  const [shots, setShots] = useState('exact')
  const [seed, setSeed] = useState(1)
  const exact = useMemo(() => exactGroundEnergy(), [])
  const trace = useMemo(() => {
    const rand = rng(seed)
    const sigma = shots === 'exact' ? 0 : H2_TERMS.reduce((s, [c]) => s + Math.abs(c), 0) / Math.sqrt(Number(shots))
    const E = (t) => vqeEnergy(t) + sigma * gaussian(rand)
    const out = []
    let theta = start
    for (let k = 0; k <= 40; k++) {
      const energy = vqeEnergy(theta)
      const grad = (E(theta + Math.PI / 2) - E(theta - Math.PI / 2)) / 2
      out.push({ iteration: k, theta, energy, error: (energy - exact) * 1000 })
      theta -= rate * grad
    }
    return out
  }, [start, rate, shots, seed, exact])
  const landscape = useMemo(() => range(121).map((k) => {
    const t = (k / 120) * 2 * Math.PI
    return { theta: +t.toFixed(3), E: vqeEnergy(t) }
  }), [])
  const last = trace.at(-1)
  const errMh = (last.energy - exact) * 1000
  return (
    <div className="space-y-4">
      <LabSection title="The optimiser walks downhill on E(θ)" aside={shots !== 'exact' && <SeedControl seed={seed} onSeed={setSeed} />}>
        <div className="grid gap-3 md:grid-cols-3">
          <Slider label="Starting θ" unit=" rad" value={start} min={0} max={6.2} step={0.1} onChange={setStart} />
          <Slider label="Learning rate" unit="" value={rate} min={0.05} max={1.2} step={0.05} onChange={setRate} />
          <div>
            <p className="mb-1 text-[11px] text-slate-400">Energy measurements</p>
            <Tabs value={shots} onChange={setShots} tabs={[{ value: 'exact', label: 'exact' }, { value: '10000', label: '10k shots' }, { value: '500', label: '500 shots' }]} />
          </div>
        </div>
        <LineChartBox data={landscape} x="theta" xLabel="ansatz angle θ (rad)" yLabel="energy (Ha)" series={[{ key: 'E', label: 'E(θ) = ⟨ψ(θ)|H|ψ(θ)⟩' }]} refLines={[{ y: exact, label: `exact ground ${exact.toFixed(4)}`, color: 'signal-green' }]} dots={trace.filter((_, i) => i % 4 === 0).map((t) => ({ x: ((t.theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), y: t.energy }))} height={220} />
      </LabSection>
      <LabSection title="Convergence">
        <LineChartBox data={trace} x="iteration" xLabel="iteration" yLabel="error (mHa)" yLog yDomain={[1e-6, 2000]} series={[{ key: 'error', label: 'E − E₀ (milli-Hartree)' }]} refLines={[{ y: CHEMICAL_ACCURACY * 1000, label: 'chemical accuracy 1.6 mHa', color: 'signal-green' }]} height={200} />
        <Stats>
          <Stat label="Final energy" value={`${last.energy.toFixed(5)} Ha`} tone="cyan" />
          <Stat label="Exact (diagonalisation)" value={`${exact.toFixed(5)} Ha`} />
          <Stat label="Error" value={`${errMh.toFixed(3)} mHa`} tone={errMh < 1.6 ? 'green' : 'rose'} />
          <Stat label="Energy evaluations" value={trace.length * 2} hint="Two per gradient (parameter shift)" />
        </Stats>
        <Note>The energy never goes below the exact value — the variational principle. With shot noise the optimiser jitters around the minimum; real experiments spend most of their time on those measurements.</Note>
      </LabSection>
    </div>
  )
}

// --- QAOA -----------------------------------------------------------------------------

const NODE = [[40, 40], [160, 40], [160, 140], [40, 140]]

function GraphView({ graph, z, height = 180 }) {
  const c = useThemeColors()
  return (
    <svg viewBox="0 0 200 180" style={{ height }} className="w-full">
      {graph.edges.map(([i, j]) => {
        const cut = ((z >> i) ^ (z >> j)) & 1
        return <line key={`${i}${j}`} x1={NODE[i][0]} y1={NODE[i][1]} x2={NODE[j][0]} y2={NODE[j][1]} stroke={cut ? c['signal-amber'] : c['slate-600']} strokeWidth={cut ? 3 : 1.5} strokeDasharray={cut ? '6 4' : ''} />
      })}
      {range(graph.n).map((v) => (
        <g key={v}>
          <circle cx={NODE[v][0]} cy={NODE[v][1]} r={14} fill={(z >> v) & 1 ? c['signal-violet'] : c['signal-cyan']} />
          <text x={NODE[v][0]} y={NODE[v][1] + 4} textAnchor="middle" fontSize={11} fill={c['lab-950']}>v{v}</text>
        </g>
      ))}
    </svg>
  )
}

export function QaoaLab() {
  const [g, setG] = useState('ring')
  const graph = GRAPHS[g]
  const best = useMemo(() => bestAngles(graph), [graph])
  const land = useMemo(() => qaoaLandscape(graph, 48, 24), [graph])
  const [pick, setPick] = useState(null)
  useEffect(() => setPick(null), [g])
  const gamma = pick ? (GAMMA_MAX * pick.c) / 47 : best.gamma
  const beta = pick ? BETA_MAX - (BETA_MAX * pick.r) / 23 : best.beta
  const p = probabilities(qaoaState(graph, gamma, beta))
  const exp = [...p].reduce((s, v, z) => s + v * cutValue(z, graph.edges), 0)
  const top = maxCut(graph)
  const winners = range(16).filter((z) => cutValue(z, graph.edges) === top)
  const bars = range(16).map((z) => ({ z: z.toString(2).padStart(4, '0'), p: p[z], cut: cutValue(z, graph.edges) }))
  const marker = pick ?? { r: Math.round(((BETA_MAX - best.beta) / BETA_MAX) * 23), c: Math.round((best.gamma / GAMMA_MAX) * 47) }
  return (
    <div className="space-y-4">
      <LabSection title="Tune the two angles">
        <Tabs value={g} onChange={setG} tabs={Object.entries(GRAPHS).map(([value, gr]) => ({ value, label: gr.label }))} />
        <div className="grid gap-4 md:grid-cols-[1fr_200px]">
          <div>
            <Heatmap values={land} onPick={(r, c) => setPick({ r, c })} marker={marker} height={200} title="Average cut ⟨C⟩ for every (γ, β)" />
            <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-500">
              <span>γ = 0</span>
              <span>⟨C⟩ over (γ →, β ↑) — click to choose</span>
              <span>γ = π</span>
            </div>
          </div>
          <div>
            <GraphView graph={graph} z={winners[0]} />
            <p className="text-center text-[10px] text-slate-500">a maximum cut ({top} edges, amber)</p>
          </div>
        </div>
        <Stats>
          <Stat label="γ, β" value={`${gamma.toFixed(2)}, ${beta.toFixed(2)}`} />
          <Stat label="Average cut ⟨C⟩" value={exp.toFixed(3)} tone="cyan" />
          <Stat label="Approximation ratio" value={pct(exp / top)} tone="green" hint="⟨C⟩ / max cut" />
          <Stat label="P(sample is a max cut)" value={pct(winners.reduce((s, z) => s + p[z], 0))} tone="violet" />
        </Stats>
      </LabSection>
      <LabSection title="What you would sample">
        <BarChartBox data={bars} x="z" series={[{ key: 'p', label: 'probability' }]} height={180} angled />
        <p className="text-[10px] text-slate-500">Bitstrings v3v2v1v0 (which side each node is on). Max cuts: {winners.map((z) => z.toString(2).padStart(4, '0')).join(', ')}. Random guessing averages {graph.edges.length / 2} edges.</p>
      </LabSection>
    </div>
  )
}

// --- Quantum walk ------------------------------------------------------------------------

export function WalkLab() {
  const [T, setT] = useState(20)
  const [coin, setCoin] = useState('symmetric')
  const q = hadamardWalk(T, coin)
  const cl = classicalWalk(T)
  const data = q.positions.map((x, i) => ({ x, quantum: q.probs[i] || null, classical: cl.probs[i] || null }))
  const growth = range(31).map((t) => ({ t, quantum: spread(hadamardWalk(t, coin)), classical: Math.sqrt(t) }))
  return (
    <div className="space-y-4">
      <LabSection title="Where is the walker after T steps?">
        <div className="grid gap-3 md:grid-cols-2">
          <Slider label="Steps T" unit="" value={T} min={1} max={40} step={1} onChange={setT} />
          <div>
            <p className="mb-1 text-[11px] text-slate-400">Starting coin</p>
            <Tabs value={coin} onChange={setCoin} tabs={[{ value: 'symmetric', label: '(|0⟩ + i|1⟩)/√2' }, { value: 'zero', label: '|0⟩ (lopsided)' }]} />
          </div>
        </div>
        <LineChartBox data={data} x="x" xLabel="position" yLabel="probability" series={[{ key: 'quantum', label: 'quantum walk' }, { key: 'classical', label: 'classical random walk', color: 'signal-violet', dashed: true }]} height={230} />
        <p className="text-xs text-slate-400">Classical: a bell curve centred on the start. Quantum: interference cancels the middle and piles probability near ±T/√2 — two fronts racing outward.</p>
      </LabSection>
      <LabSection title="Spread (standard deviation) over time">
        <LineChartBox data={growth} x="t" xLabel="steps" yLabel="σ" series={[{ key: 'quantum', label: 'quantum ∝ t' }, { key: 'classical', label: 'classical = √t', color: 'signal-violet', dashed: true }]} height={200} />
        <Stats>
          <Stat label="Quantum σ" value={spread(q).toFixed(2)} tone="cyan" />
          <Stat label="Classical σ" value={spread(cl).toFixed(2)} tone="violet" />
          <Stat label="Ratio" value={`${(spread(q) / spread(cl)).toFixed(2)}×`} tone="green" />
          <Stat label="Steps to reach distance d" value="d vs d²" hint="quadratic speed-up in hitting time" />
        </Stats>
      </LabSection>
    </div>
  )
}

// --- Element distinctness ------------------------------------------------------------------

const SUBSETS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]
const LISTS = { a: [3, 1, 3, 0], b: [2, 0, 1, 2], c: [0, 1, 2, 1] }

export function DistinctnessLab() {
  const c = useThemeColors()
  const [list, setList] = useState('a')
  const values = LISTS[list]
  const pos = SUBSETS.map((_, i) => [110 + 80 * Math.cos((i * Math.PI) / 3 - Math.PI / 2), 100 + 80 * Math.sin((i * Math.PI) / 3 - Math.PI / 2)])
  const marked = (s) => values[s[0]] === values[s[1]]
  const edges = []
  SUBSETS.forEach((a, i) => SUBSETS.forEach((b, j) => j > i && a.filter((x) => b.includes(x)).length === 1 && edges.push([i, j])))
  const scaling = range(7).map((k) => {
    const N = 10 ** k
    return { N, classical: N, grover: N, ambainis: N ** (2 / 3) }
  })
  return (
    <div className="space-y-4">
      <LabSection title="The Johnson graph J(4, 2): walking between pairs">
        <Tabs value={list} onChange={setList} tabs={Object.entries(LISTS).map(([value, v]) => ({ value, label: `[${v.join(', ')}]` }))} />
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <svg viewBox="0 0 220 200" className="w-full max-w-[240px]">
            {edges.map(([i, j]) => (
              <line key={`${i}${j}`} x1={pos[i][0]} y1={pos[i][1]} x2={pos[j][0]} y2={pos[j][1]} stroke={c['lab-600']} />
            ))}
            {SUBSETS.map((s, i) => (
              <g key={i}>
                <circle cx={pos[i][0]} cy={pos[i][1]} r={18} fill={marked(s) ? c['signal-amber'] : c['lab-850']} stroke={c['slate-400']} />
                <text x={pos[i][0]} y={pos[i][1] + 4} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill={marked(s) ? c['lab-950'] : c['slate-200']}>{`{${s.join(',')}}`}</text>
              </g>
            ))}
          </svg>
          <div className="space-y-2 text-xs text-slate-400">
            <p>Each vertex is a set of r = 2 indices whose values are "in memory"; neighbours differ by swapping one index (each swap costs one query).</p>
            <p>The amber vertex holds the colliding pair (x = {values.join(', ')}). Ambainis’ walk spreads over these vertices and, like Grover, amplifies the marked one — but because neighbours share stored values, each step costs 1 query instead of r.</p>
            <p>For N items and sets of size r = N^{'{2/3}'}: setup r + (√(N/r) rounds × √r steps) ≈ N^{'{2/3}'} queries, which is optimal.</p>
          </div>
        </div>
      </LabSection>
      <LabSection title="Queries needed for N items">
        <LineChartBox data={scaling} x="N" xLog yLog xLabel="list size N" yLabel="queries" series={[{ key: 'classical', label: 'classical (sort / hash): N', color: 'signal-rose' }, { key: 'ambainis', label: 'Ambainis quantum walk: N^{2/3}' }]} height={210} />
        <Note>At N = 10⁶: a million classical lookups vs about 10 000 quantum ones. The circuit tab runs the simpler Grover-over-pairs version on 4 items.</Note>
      </LabSection>
    </div>
  )
}

// --- Triangle finding -----------------------------------------------------------------------

const TRI_POS = [[40, 150], [40, 40], [160, 40], [160, 150]]

export function TriangleLab() {
  const c = useThemeColors()
  const [g, setG] = useState('a')
  const { edges } = TRIANGLE_GRAPHS[g]
  const idx = TRIPLES.findIndex((t) => isTriangle(edges, t))
  const tri = TRIPLES[idx]
  const inTri = (a, b) => tri.includes(a) && tri.includes(b)
  const scaling = range(6).map((k) => {
    const n = 10 * 4 ** k
    return { n, classical: n ** 3, grover: n ** 1.5, mss: n ** 1.3, legall: n ** 1.25 }
  })
  return (
    <div className="space-y-4">
      <LabSection title="Find three mutually connected vertices">
        <Tabs value={g} onChange={setG} tabs={Object.entries(TRIANGLE_GRAPHS).map(([value, gr]) => ({ value, label: gr.label }))} />
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <svg viewBox="0 0 200 190" className="w-full max-w-[220px]">
            {edges.map(([a, b]) => (
              <line key={`${a}${b}`} x1={TRI_POS[a][0]} y1={TRI_POS[a][1]} x2={TRI_POS[b][0]} y2={TRI_POS[b][1]} stroke={inTri(a, b) ? c['signal-amber'] : c['slate-500']} strokeWidth={inTri(a, b) ? 3.5 : 1.5} />
            ))}
            {range(4).map((v) => (
              <g key={v}>
                <circle cx={TRI_POS[v][0]} cy={TRI_POS[v][1]} r={14} fill={tri.includes(v) ? c['signal-amber'] : c['lab-850']} stroke={c['slate-400']} />
                <text x={TRI_POS[v][0]} y={TRI_POS[v][1] + 4} textAnchor="middle" fontSize={11} fill={tri.includes(v) ? c['lab-950'] : c['slate-200']}>{v}</text>
              </g>
            ))}
          </svg>
          <table className="h-fit w-full text-center font-mono text-[11px]">
            <thead>
              <tr className="text-[10px] text-slate-500"><th>index t</th><th>triple</th><th>3 edges?</th></tr>
            </thead>
            <tbody>
              {TRIPLES.map((t, i) => (
                <tr key={i} className={`border-t border-lab-700/60 ${i === idx ? 'text-signal-amber' : 'text-slate-400'}`}>
                  <td>{i.toString(2).padStart(2, '0')}</td>
                  <td>{`{${t.join(', ')}}`}</td>
                  <td>{isTriangle(edges, t) ? 'yes ✓' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LabSection>
      <LabSection title="Edge queries for an n-vertex graph">
        <LineChartBox data={scaling} x="n" xLog yLog xLabel="vertices n" yLabel="queries" series={[{ key: 'classical', label: 'check every triple: n³', color: 'signal-rose' }, { key: 'grover', label: 'Grover over triples: n^1.5', color: 'signal-violet' }, { key: 'mss', label: 'Magniez–Santha–Szegedy walk: n^1.3', color: 'signal-amber' }, { key: 'legall', label: 'Le Gall (2014): n^1.25' }]} height={230} />
        <Note>Grover alone gets √(n³). Quantum walks do better by keeping a set of queried edges in memory and updating it a little each step, so most edge checks are reused. The best-known lower bound is n — the true answer is still open.</Note>
      </LabSection>
    </div>
  )
}

// --- QSVM ------------------------------------------------------------------------------------

function DecisionMap({ grid, points, height = 260 }) {
  const ref = useRef(null)
  const c = useThemeColors()
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    const { width: W, height: H } = canvas
    const n = grid.length
    const pos = c['signal-cyan'].match(/\d+/g).map(Number)
    const neg = c['signal-violet'].match(/\d+/g).map(Number)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const v = Math.tanh(grid[i][j])
        const col = v > 0 ? pos : neg
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.08 + 0.32 * Math.abs(v)})`
        ctx.fillRect(Math.floor((j * W) / n), Math.floor(((n - 1 - i) * H) / n), Math.ceil(W / n) + 1, Math.ceil(H / n) + 1)
      }
    for (const p of points) {
      const x = (p.x[0] / (2 * Math.PI)) * W
      const y = H - (p.x[1] / (2 * Math.PI)) * H
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, 2 * Math.PI)
      ctx.fillStyle = p.y > 0 ? c['signal-cyan'] : c['signal-violet']
      ctx.fill()
      ctx.lineWidth = p.wrong ? 3 : 1.5
      ctx.strokeStyle = p.wrong ? c['signal-rose'] : c['slate-200']
      ctx.stroke()
    }
  }, [grid, points, c])
  return <canvas ref={ref} width={420} height={420} style={{ height }} className="mx-auto block aspect-square rounded-md border border-lab-700" />
}

export function QsvmLab() {
  const [kernel, setKernel] = useState('quantum')
  const train = useMemo(() => makeDataset(7, 24), [])
  const test = useMemo(() => makeDataset(21, 24), [])
  const result = useMemo(() => {
    const k = kernel === 'quantum' ? quantumKernel : (a, b) => rbfKernel(a, b, 0.5)
    const enc = (x) => (kernel === 'quantum' ? featureState(x) : x)
    const tr = train.map((p) => enc(p.x))
    const K = tr.map((a) => tr.map((b) => k(a, b)))
    const y = train.map((p) => p.y)
    const model = trainSvm(K, y)
    const decide = (x) => {
      const e = enc(x)
      return svmDecision(model, y, tr.map((t) => k(t, e)))
    }
    const n = 32
    const grid = range(n).map((i) => range(n).map((j) => decide([((j + 0.5) / n) * 2 * Math.PI, ((i + 0.5) / n) * 2 * Math.PI])))
    const trainAcc = train.filter((p, i) => Math.sign(svmDecision(model, y, K[i])) === p.y).length / train.length
    const testMarks = test.map((p) => ({ ...p, wrong: Math.sign(decide(p.x)) !== p.y }))
    const testAcc = testMarks.filter((p) => !p.wrong).length / test.length
    return { K, grid, trainAcc, testAcc, testMarks, sv: model.alpha.filter((a) => a > 1e-6).length }
  }, [kernel, train, test])
  return (
    <div className="space-y-4">
      <LabSection title="Train an SVM on a quantum kernel">
        <Tabs value={kernel} onChange={setKernel} tabs={[{ value: 'quantum', label: 'quantum kernel (ZZ feature map)' }, { value: 'rbf', label: 'classical RBF kernel' }]} />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <DecisionMap grid={result.grid} points={result.testMarks} />
            <p className="mt-1 text-center text-[10px] text-slate-500">Shaded: predicted class over (x₀, x₁) ∈ [0, 2π]². Dots: unseen test points (red ring = misclassified).</p>
          </div>
          <div>
            <Heatmap values={result.K} min={0} max={1} height={220} title="Kernel matrix K(xᵢ, xⱼ)" />
            <p className="mt-1 text-center text-[10px] text-slate-500">Kernel matrix of the 24 training points (bright = similar). Each entry = one overlap circuit on hardware.</p>
          </div>
        </div>
        <Stats>
          <Stat label="Training accuracy" value={pct(result.trainAcc, 0)} />
          <Stat label="Test accuracy" value={pct(result.testAcc, 0)} tone={result.testAcc > 0.85 ? 'green' : 'amber'} />
          <Stat label="Support vectors" value={result.sv} />
          <Stat label="Kernel circuits needed" value={(24 * 23) / 2} hint="one per training pair" />
        </Stats>
        <Note>
          These labels were defined by a quantum observable (Havlíček et al. 2019), so the quantum kernel fits them naturally while the RBF kernel struggles. On ordinary data a classical kernel is usually as good — an advantage needs both a hard-to-simulate feature map and data that suits it.
        </Note>
      </LabSection>
    </div>
  )
}

// --- QPCA ------------------------------------------------------------------------------------

export function QpcaLab() {
  const [angle, setAngle] = useState(30)
  const alpha = (angle * Math.PI) / 180
  const pts = useMemo(() => qpcaData(alpha).map(([x, y]) => ({ x, y })), [alpha])
  const rho = qpcaRho(alpha)
  const { values, vectors } = eigSym(rho)
  const axis = (k, len) => [{ x: -len * vectors[k][0], y: -len * vectors[k][1] }, { x: len * vectors[k][0], y: len * vectors[k][1] }]
  return (
    <div className="space-y-4">
      <LabSection title="Data → density matrix → principal components">
        <Slider label="Tilt of the data cloud" value={angle} min={0} max={180} step={5} onChange={setAngle} />
        <div className="grid gap-4 md:grid-cols-2">
          <ScatterBox
            square
            xDomain={[-2.5, 2.5]}
            yDomain={[-2.5, 2.5]}
            groups={[
              { label: 'data', points: pts, color: 'slate-400' },
              { label: `PC1 (λ = ${values[1].toFixed(2)})`, points: axis(1, 2.2), color: 'signal-cyan', line: true },
              { label: `PC2 (λ = ${values[0].toFixed(2)})`, points: axis(0, 1.2), color: 'signal-violet', line: true },
            ]}
            height={280}
          />
          <div className="space-y-3">
            <p className="font-mono text-xs text-slate-300">
              ρ = [[{rho[0][0].toFixed(3)}, {rho[0][1].toFixed(3)}], [{rho[1][0].toFixed(3)}, {rho[1][1].toFixed(3)}]]
            </p>
            <BarChartBox data={[{ c: 'clock = 3 (λ = ¾)', p: values[1] }, { c: 'clock = 1 (λ = ¼)', p: values[0] }]} x="c" series={[{ key: 'p', label: 'QPCA outcome probability' }]} yDomain={[0, 1]} height={170} />
            <p className="text-xs text-slate-400">Phase estimation on e^{'{2πiρ}'} samples each component with probability equal to its variance share, and leaves the qubit pointing along it.</p>
          </div>
        </div>
        <Note tone="amber">The speed-up assumes ρ is available as many copies of a quantum state — loading classical data into that form can cost as much as classical PCA, and "dequantised" classical algorithms match QPCA for low-rank data.</Note>
      </LabSection>
    </div>
  )
}

// --- Hamiltonian simulation -------------------------------------------------------------------

export function HamSimLab() {
  const [J, setJ] = useState(1)
  const [h, setH] = useState(1)
  const [n, setN] = useState(4)
  const [order, setOrder] = useState('1')
  const tMax = 3
  const curve = useMemo(() => {
    const dt = tMax / n
    return range(61).map((k) => {
      const t = (k / 60) * tMax
      const steps = Math.round(t / dt)
      const onGrid = Math.abs(steps * dt - t) < 1e-9
      return { t: +t.toFixed(3), exact: zExpect(exactState(J, h, t)), trotter: onGrid ? zExpect(trotterState(J, h, t, Math.max(1, steps), Number(order))) : null }
    })
  }, [J, h, n, order])
  const err = useMemo(
    () =>
      [1, 2, 4, 8, 16, 32, 64].map((s) => ({
        n: s,
        first: infidelity(exactState(J, h, tMax), trotterState(J, h, tMax, s, 1)),
        second: infidelity(exactState(J, h, tMax), trotterState(J, h, tMax, s, 2)),
      })),
    [J, h],
  )
  return (
    <div className="space-y-4">
      <LabSection title="Exact evolution vs. Trotter slices">
        <div className="grid gap-3 md:grid-cols-4">
          <Slider label="Coupling J" unit="" value={J} min={0} max={2} step={0.1} onChange={setJ} />
          <Slider label="Field h" unit="" value={h} min={0} max={2} step={0.1} onChange={setH} />
          <Slider label={`Slices over t = ${tMax}`} unit="" value={n} min={1} max={30} step={1} onChange={setN} />
          <div>
            <p className="mb-1 text-[11px] text-slate-400">Trotter order</p>
            <Tabs value={order} onChange={setOrder} tabs={[{ value: '1', label: '1st' }, { value: '2', label: '2nd' }]} />
          </div>
        </div>
        <LineChartBox data={curve} x="t" xLabel="time t" yLabel="⟨Z₀⟩" yDomain={[-1, 1]} series={[{ key: 'exact', label: 'exact e^{−iHt}' }, { key: 'trotter', label: `Trotter (${n} slices)`, color: 'signal-amber', dots: true }]} height={230} />
        <p className="text-xs text-slate-400">{J === 0 || h === 0 ? 'With J or h at zero the two terms commute and Trotter is exact — the error comes entirely from [A, B] ≠ 0.' : 'Few slices drift away from the exact curve; more slices hug it.'}</p>
      </LabSection>
      <LabSection title="Error vs. number of slices">
        <LineChartBox data={err} x="n" xLog yLog xLabel="slices n" yLabel="infidelity at t = 3" series={[{ key: 'first', label: '1st order (∝ 1/n²)' }, { key: 'second', label: '2nd order (∝ 1/n⁴)', color: 'signal-green' }]} height={210} />
        <Note>Infidelity is the squared error of the state, so 1st-order Trotter (error ∝ t²/n) shows slope −2 here and the symmetric 2nd-order formula slope −4. Classically this 2-spin system is trivial; at 50+ spins the exact curve can no longer be computed, and only the quantum circuit remains.</Note>
      </LabSection>
    </div>
  )
}

// --- Boson sampling ---------------------------------------------------------------------------

export function BosonLab() {
  const [delay, setDelay] = useState(0)
  const [seed, setSeed] = useState(42)
  const overlap = Math.exp(-(delay ** 2))
  const dip = range(61).map((k) => {
    const d = -3 + k * 0.1
    return { d: +d.toFixed(1), coincidence: homCoincidence(Math.exp(-(d ** 2))) }
  })
  const U = useMemo(() => randomInterferometer(6, seed), [seed])
  const dist = useMemo(() => bosonDistribution(U, [0, 1, 2]), [U])
  const top = [...dist].sort((a, b) => b.boson - a.boson).slice(0, 12).map((o) => ({ pattern: o.pattern.join(''), boson: o.boson, distinguishable: o.dist }))
  const bunch = (key) => dist.filter((o) => o.collision).reduce((s, o) => s + o[key], 0)
  return (
    <div className="space-y-4">
      <LabSection title="Two photons, one beam splitter: the Hong–Ou–Mandel dip">
        <Slider label="Arrival-time delay (pulse widths)" unit="" value={delay} min={-3} max={3} step={0.1} onChange={setDelay} />
        <LineChartBox data={dip} x="d" xLabel="delay" yLabel="P(one photon each way)" yDomain={[0, 0.55]} series={[{ key: 'coincidence', label: 'coincidence probability' }]} dots={[{ x: delay, y: homCoincidence(overlap) }]} refLines={[{ y: 0.5, label: 'distinguishable: ½', color: 'slate-500' }]} height={200} />
        <p className="text-xs text-slate-400">When the photons are identical (zero delay) the two ways of "one each" cancel exactly: they always leave together. That interference is what makes boson sampling hard to simulate.</p>
      </LabSection>
      <LabSection title="Three photons in a random 6-mode interferometer" aside={<SeedControl seed={seed} onSeed={setSeed} />}>
        <BarChartBox data={top} x="pattern" xLabel="output pattern (photons per mode)" series={[{ key: 'boson', label: 'identical photons |Perm|²' }, { key: 'distinguishable', label: 'distinguishable Perm(|U|²)', color: 'signal-violet' }]} height={210} angled />
        <Stats>
          <Stat label="Output patterns" value={dist.length} />
          <Stat label="Bunched (2+ in a mode)" value={pct(bunch('boson'))} tone="cyan" hint="identical photons" />
          <Stat label="…if distinguishable" value={pct(bunch('dist'))} tone="violet" />
          <Stat label="Largest |Uᵢⱼ|²" value={Math.max(...U.flat().map(cabs2)).toFixed(3)} />
        </Stats>
        <Note>Exact here because 3×3 permanents are easy. Every extra photon multiplies the work — at ~50 photons in ~100 modes no classical computer can produce these probabilities, which was the basis of the Jiuzhang quantum-advantage experiment (2020).</Note>
      </LabSection>
    </div>
  )
}
