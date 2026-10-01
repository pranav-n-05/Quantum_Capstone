import { useMemo, useState } from 'react'

import { range } from '../../../quantum/numeric'
import {
  b92Run,
  BB84_THRESHOLD,
  bb84ExpectedQber,
  bb84Rate,
  bb84Run,
  channelEta,
  chsh,
  cvRate,
  cvSamples,
  e91Correlation,
  e91Run,
  E91_ALICE,
  E91_BOB,
  honestGain,
  mdiRun,
  plob,
  pnsAttack,
  poisson,
  tfFringe,
  tfRate,
  transmittance,
  y1Lower,
} from '../../../quantum/labs/qkd'
import { Slider, Tabs } from '../../bloch/ui'
import { BarChartBox, LabSection, LineChartBox, Note, pct, ScatterBox, SeedControl, Stat, Stats } from './kit'

const GLYPH = { Z: ['↔', '↕'], X: ['⤢', '⤡'] }
const glyph = (basis, bit) => GLYPH[basis][bit]
const deg = (r) => `${Math.round((r * 180) / Math.PI)}°`

function RoundsTable({ head, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-center font-mono text-[11px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-500">
            {head.map((h) => (
              <th key={h} className="px-1.5 py-1 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-t border-lab-700/60">
              {cells.map((cell, j) => (
                <td key={j} className="px-1.5 py-1 text-slate-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ok = (b) => (b ? <span className="text-signal-green">✓</span> : <span className="text-slate-600">·</span>)
const bad = (b) => (b ? <span className="text-signal-rose">✗</span> : <span className="text-slate-600">·</span>)
const SIZES = [{ value: '200', label: '200' }, { value: '1000', label: '1 000' }, { value: '5000', label: '5 000' }]

// --- BB84 -------------------------------------------------------------------------

export function Bb84Lab() {
  const [eve, setEve] = useState(0)
  const [n, setN] = useState('1000')
  const [seed, setSeed] = useState(1)
  const run = useMemo(() => bb84Run({ n: Number(n), eve: eve / 100, seed }), [n, eve, seed])
  const curve = useMemo(() => range(11).map((k) => ({ eve: k * 10, theory: bb84ExpectedQber(k / 10) * 100 })), [])

  return (
    <div className="space-y-4">
      <LabSection title="Run BB84" aside={<SeedControl seed={seed} onSeed={setSeed} />}>
        <div className="grid gap-4 md:grid-cols-2">
          <Slider label="Eve intercepts this fraction of photons" unit="%" value={eve} min={0} max={100} step={5} onChange={setEve} />
          <div>
            <p className="mb-1 text-[11px] text-slate-400">Photons sent</p>
            <Tabs value={n} onChange={setN} tabs={SIZES} />
          </div>
        </div>
        <Stats>
          <Stat label="Sifted (same basis)" value={`${run.sifted}`} hint="Rounds where Alice and Bob happened to choose the same basis" />
          <Stat label="Errors in sifted key" value={run.errors} tone={run.errors ? 'rose' : 'green'} />
          <Stat label="QBER" value={pct(run.qber)} tone={run.secure ? 'green' : 'rose'} />
          <Stat label="Secret bits / sifted bit" value={run.keyRate.toFixed(3)} tone={run.keyRate > 0 ? 'cyan' : 'rose'} hint="1 − 2·h(QBER): what survives error correction and privacy amplification" />
        </Stats>
        <Note tone={run.secure ? 'green' : 'rose'}>
          {run.secure
            ? `QBER ${pct(run.qber)} is below ${pct(BB84_THRESHOLD, 0)}: Alice and Bob distil a secret key. ${eve ? 'Eve was present, but she learned too little to matter after privacy amplification.' : ''}`
            : `QBER ${pct(run.qber)} is above ${pct(BB84_THRESHOLD, 0)}: someone is listening. Alice and Bob throw the key away — Eve gains nothing either.`}
        </Note>
      </LabSection>

      <LabSection title="First 14 rounds">
        <RoundsTable
          head={['#', 'Alice bit', 'Alice sends', ...(eve ? ['Eve'] : []), 'Bob basis', 'Bob reads', 'Kept', 'Error']}
          rows={run.rounds.slice(0, 14).map((r, i) => [
            i + 1,
            r.aliceBit,
            <span key="s" className="text-signal-cyan">
              {glyph(r.aliceBasis, r.aliceBit)} {r.aliceBasis}
            </span>,
            ...(eve ? [r.eveActive ? <span key="e" className="text-signal-rose">{r.eveBasis}</span> : '—'] : []),
            r.bobBasis,
            r.bobBit,
            ok(r.kept),
            bad(r.error),
          ])}
        />
        <p className="text-[10px] text-slate-500">↔ ↕ = Z basis (0, 1) · ⤢ ⤡ = X basis (0, 1). Rows with different bases are discarded after the public comparison.</p>
      </LabSection>

      <LabSection title="Why 25%: QBER vs. how much Eve listens">
        <LineChartBox
          data={curve}
          x="eve"
          xLabel="% of photons Eve intercepts"
          yLabel="QBER %"
          series={[{ key: 'theory', label: 'Theory: ¼ × fraction' }]}
          refLines={[{ y: BB84_THRESHOLD * 100, label: '11% abort threshold', color: 'signal-rose' }]}
          dots={[{ x: eve, y: run.qber * 100 }]}
        />
        <p className="text-xs text-slate-400">
          Eve picks the wrong basis half the time; then Bob reads the wrong bit half of those times. ½ × ½ = 25% errors on intercepted photons. The amber dot is your run.
        </p>
      </LabSection>
    </div>
  )
}

// --- E91 --------------------------------------------------------------------------

export function E91Lab() {
  const [eve, setEve] = useState(0)
  const [seed, setSeed] = useState(1)
  const run = useMemo(() => e91Run({ n: 6000, eve: eve / 100, seed }), [eve, seed])
  const S = Math.abs(run.S)
  const theoryS = Math.abs(chsh((a, b) => e91Correlation(a, b, eve / 100)))
  const curve = useMemo(() => range(11).map((k) => ({ eve: k * 10, S: Math.abs(chsh((a, b) => e91Correlation(a, b, k / 10))) })), [])
  const measured = (ai, bi) => {
    const rs = run.rounds.filter((r) => r.ai === ai && r.bi === bi)
    return rs.length ? rs.reduce((s, r) => s + r.A * r.B, 0) / rs.length : 0
  }

  return (
    <div className="space-y-4">
      <LabSection title="Run E91 (6 000 pairs)" aside={<SeedControl seed={seed} onSeed={setSeed} />}>
        <Slider label="Eve intercepts this fraction of pairs" unit="%" value={eve} min={0} max={100} step={5} onChange={setEve} />
        <Stats>
          <Stat label="|S| measured" value={S.toFixed(3)} tone={S > 2 ? 'green' : 'rose'} />
          <Stat label="|S| theory" value={theoryS.toFixed(3)} />
          <Stat label="Key bits" value={run.keyLength} tone="cyan" />
          <Stat label="Key error rate" value={pct(run.qber)} tone={run.qber ? 'rose' : 'green'} />
        </Stats>
        <div className="relative h-8 rounded-lg bg-lab-850">
          <div className="absolute inset-y-0 left-0 rounded-l-lg bg-signal-rose/15" style={{ width: `${(2 / 3) * 100}%` }} />
          <span className="absolute top-1 text-[9px] text-signal-rose" style={{ left: '2%' }}>classical (local) region |S| ≤ 2</span>
          <span className="absolute bottom-0 h-full border-l-2 border-dashed border-slate-500" style={{ left: `${(2 / 3) * 100}%` }} />
          <span className="absolute bottom-0 h-full border-l-2 border-dashed border-signal-green" style={{ left: `${((2 * Math.SQRT2) / 3) * 100}%` }} />
          <span className="absolute h-full w-1.5 -translate-x-1/2 rounded bg-signal-amber" style={{ left: `${(Math.min(S, 3) / 3) * 100}%` }} title="your |S|" />
          <span className="absolute right-1 top-1 text-[9px] text-signal-green">2√2 ≈ 2.83</span>
        </div>
        <Note tone={S > 2.2 ? 'green' : 'rose'}>
          {S > 2.2
            ? 'The correlations beat every classical explanation: the pairs were really entangled, so nobody else can share them. Keep the key.'
            : 'The Bell violation is gone — the pairs behave like pre-arranged classical data, exactly what an intercepting Eve leaves behind. Abort.'}
        </Note>
      </LabSection>

      <LabSection title="Correlations ⟨A·B⟩ for every angle pair">
        <div className="overflow-x-auto">
          <table className="w-full text-center font-mono text-[11px]">
            <thead>
              <tr className="text-[10px] text-slate-500">
                <th className="py-1">Alice ↓ / Bob →</th>
                {E91_BOB.map((b) => (
                  <th key={b}>{deg(b)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {E91_ALICE.map((a, ai) => (
                <tr key={a} className="border-t border-lab-700/60">
                  <td className="py-1 text-slate-500">{deg(a)}</td>
                  {E91_BOB.map((b, bi) => {
                    const key = (ai === 1 && bi === 0) || (ai === 2 && bi === 1)
                    const chshCell = (ai === 0 || ai === 2) && (bi === 0 || bi === 2)
                    return (
                      <td key={b} className={`py-1 ${key ? 'bg-signal-cyan/10 text-signal-cyan' : chshCell ? 'bg-signal-violet/10 text-signal-violet' : 'text-slate-400'}`}>
                        {measured(ai, bi).toFixed(2)}
                        <span className="block text-[9px] text-slate-500">theory {e91Correlation(a, b, eve / 100).toFixed(2)}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-500">
          <span className="text-signal-cyan">Cyan</span>: same angle → key bits (always opposite, Bob flips). <span className="text-signal-violet">Violet</span>: the four pairs in S = E(0°,45°) − E(0°,135°) + E(90°,45°) + E(90°,135°).
        </p>
      </LabSection>

      <LabSection title="Eve destroys the Bell violation">
        <LineChartBox data={curve} x="eve" xLabel="% of pairs Eve intercepts" yLabel="|S|" series={[{ key: 'S', label: '|S| (theory)' }]} refLines={[{ y: 2, label: 'classical limit 2', color: 'signal-rose' }]} dots={[{ x: eve, y: S }]} yDomain={[0, 3]} />
      </LabSection>
    </div>
  )
}

// --- B92 --------------------------------------------------------------------------

export function B92Lab() {
  const [eve, setEve] = useState(0)
  const [seed, setSeed] = useState(1)
  const run = useMemo(() => b92Run({ n: 2000, eve: eve / 100, seed }), [eve, seed])
  const curve = useMemo(() => range(6).map((k) => ({ eve: k * 20, qber: b92Run({ n: 6000, eve: k / 5, seed: 99 }).qber * 100 })), [])
  return (
    <div className="space-y-4">
      <LabSection title="Run B92 (2 000 photons)" aside={<SeedControl seed={seed} onSeed={setSeed} />}>
        <Slider label="Eve intercepts" unit="%" value={eve} min={0} max={100} step={10} onChange={setEve} />
        <Stats>
          <Stat label="Conclusive rounds" value={pct(run.rate)} tone="cyan" hint="Theory: 25%" />
          <Stat label="Key bits" value={run.kept} />
          <Stat label="Errors" value={run.errors} tone={run.errors ? 'rose' : 'green'} />
          <Stat label="QBER" value={pct(run.qber)} tone={run.qber > 0.11 ? 'rose' : 'green'} />
        </Stats>
      </LabSection>
      <LabSection title="First 14 rounds">
        <RoundsTable
          head={['#', 'Alice bit', 'Sends', 'Bob basis', 'Outcome', 'Conclusive → bit', 'Error']}
          rows={run.rounds.slice(0, 14).map((r, i) => [i + 1, r.aliceBit, r.aliceBit ? '|+⟩' : '|0⟩', r.bobBasis, r.outcome, r.kept ? <span key="k" className="text-signal-cyan">{r.bobBit}</span> : <span key="k" className="text-slate-600">inconclusive</span>, bad(r.error)])}
        />
        <p className="text-[10px] text-slate-500">Bob only trusts outcome 1: in Z it rules out |0⟩ (so bit 1); in X it means |−⟩, which rules out |+⟩ (so bit 0).</p>
      </LabSection>
      <LabSection title="Errors appear only with Eve">
        <LineChartBox data={curve} x="eve" xLabel="% intercepted" yLabel="QBER %" series={[{ key: 'qber', label: 'QBER (simulated)', dots: true }]} dots={[{ x: eve, y: run.qber * 100 }]} />
      </LabSection>
    </div>
  )
}

// --- MDI-QKD ----------------------------------------------------------------------

const stateLabel = (s) => ({ Z0: '|0⟩', Z1: '|1⟩', X0: '|+⟩', X1: '|−⟩' })[s.basis + s.bit]

export function MdiLab() {
  const [seed, setSeed] = useState(1)
  const run = useMemo(() => mdiRun({ n: 2000, seed }), [seed])
  const kept = run.rounds.filter((r) => r.kept)
  // What does Charlie learn about Alice's bit from his own announcement?
  const charlieGuess = kept.length ? kept.filter((r) => r.alice.bit === 0).length / kept.length : 0
  return (
    <div className="space-y-4">
      <LabSection title="Run MDI-QKD (2 000 rounds)" aside={<SeedControl seed={seed} onSeed={setSeed} />}>
        <Stats>
          <Stat label="Charlie announces Ψ±" value={pct(run.success)} hint="Linear optics: at most half of Bell outcomes" />
          <Stat label="Sifted key bits" value={run.kept} tone="cyan" />
          <Stat label="Errors" value={run.errors} tone={run.errors ? 'rose' : 'green'} />
          <Stat label="Alice’s bit = 0 among kept" value={pct(charlieGuess)} tone="violet" hint="Charlie’s announcement leaves Alice’s bit a fair coin to him" />
        </Stats>
        <Note tone="green">
          Every kept round decodes correctly, yet Alice’s bit is 0 about {pct(charlieGuess, 0)} of the time whatever Charlie announced: he learns only whether the two bits are equal, never what they are.
        </Note>
      </LabSection>
      <LabSection title="First 14 rounds">
        <RoundsTable
          head={['#', 'Alice', 'Bob', 'Charlie says', 'Kept', 'Bob’s key', 'Alice’s key']}
          rows={run.rounds.slice(0, 14).map((r, i) => [
            i + 1,
            stateLabel(r.alice),
            stateLabel(r.bob),
            r.announced ? <span key="c" className="text-signal-violet">{r.outcome}</span> : <span key="c" className="text-slate-600">fail ({r.outcome})</span>,
            ok(r.kept),
            r.kept ? r.bobKey : '—',
            r.kept ? r.alice.bit : '—',
          ])}
        />
      </LabSection>
    </div>
  )
}

// --- Decoy states -----------------------------------------------------------------

export function DecoyLab() {
  const [L, setL] = useState(50)
  const [mu, setMu] = useState(0.5)
  const [nu, setNu] = useState(0.1)
  const [attack, setAttack] = useState('off')
  const y0 = 1e-5
  const eta = transmittance(L)
  const atk = pnsAttack(mu, eta, y0)
  const attacked = attack === 'on' && atk
  const Q = (m) => (attacked ? atk.gain(m) : honestGain(m, eta, y0))
  const bound = y1Lower(mu, nu, Q(mu), Q(nu), y0)
  const photons = range(4).map((k) => ({
    n: k === 3 ? '3+' : String(k),
    signal: k === 3 ? 1 - poisson(mu, 0) - poisson(mu, 1) - poisson(mu, 2) : poisson(mu, k),
    decoy: k === 3 ? 1 - poisson(nu, 0) - poisson(nu, 1) - poisson(nu, 2) : poisson(nu, k),
  }))
  const curve = range(41).map((k) => {
    const m = k / 40
    return { mu: m, honest: honestGain(m, eta, y0) * 1e3, attack: atk ? atk.gain(m) * 1e3 : null }
  })
  return (
    <div className="space-y-4">
      <LabSection title="Laser pulses are not single photons">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Slider label="Signal intensity μ" unit="" value={mu} min={0.2} max={0.8} step={0.05} onChange={setMu} />
            <Slider label="Decoy intensity ν" unit="" value={nu} min={0.02} max={0.2} step={0.01} onChange={setNu} />
            <Slider label="Fibre length" unit=" km" value={L} min={10} max={150} step={5} onChange={setL} />
            <div>
              <p className="mb-1 text-[11px] text-slate-400">Eve’s photon-number-splitting attack</p>
              <Tabs value={attack} onChange={setAttack} tabs={[{ value: 'off', label: 'off' }, { value: 'on', label: 'on' }]} />
            </div>
          </div>
          <div>
            <BarChartBox data={photons} x="n" xLabel="photons in a pulse" series={[{ key: 'signal', label: `signal μ=${mu}` }, { key: 'decoy', label: `decoy ν=${nu}`, color: 'signal-violet' }]} height={190} />
            <p className="text-[10px] text-slate-500">
              {pct(photons[2].signal + photons[3].signal)} of signal pulses carry 2+ photons — Eve can keep one and forward the rest undetected.
            </p>
          </div>
        </div>
      </LabSection>

      <LabSection title="Click rates (gains) per intensity">
        {attack === 'on' && !atk && <Note tone="amber">At {L} km Eve cannot fake the honest signal gain even by blocking every single-photon pulse — the channel is too short for this attack. Increase the distance.</Note>}
        <Stats>
          <Stat label="Channel transmittance η" value={eta.toExponential(2)} />
          <Stat label="Signal gain Q_μ" value={Q(mu).toExponential(2)} />
          <Stat label="Decoy gain Q_ν" value={Q(nu).toExponential(2)} tone={attacked ? 'rose' : 'slate'} />
          <Stat label="Y₁ lower bound" value={bound > 0 ? bound.toExponential(2) : '≤ 0'} tone={bound > 0.5 * eta ? 'green' : 'rose'} hint="Lo–Ma–Chen bound from the three gains" />
        </Stats>
        <Note tone={bound > 0.5 * eta ? 'green' : 'rose'}>
          {bound > 0.5 * eta
            ? `The decoys certify Y₁ ≥ ${bound.toExponential(2)} ≈ η: the single-photon pulses really reached Bob. Key is safe.`
            : `Eve matched the signal gain, but the decoy gain does not fit an honest channel. The bound on single-photon yield collapses to ${bound > 0 ? bound.toExponential(1) : 'zero'} — abort.`}
        </Note>
        <LineChartBox
          data={curve}
          x="mu"
          xLabel="pulse intensity"
          yLabel="gain × 10⁻³"
          series={[{ key: 'honest', label: 'honest channel' }, ...(atk ? [{ key: 'attack', label: 'PNS attack (tuned to the signal)', color: 'signal-rose', dashed: true }] : [])]}
          refLines={[{ x: mu, label: 'signal', color: 'signal-cyan' }, { x: nu, label: 'decoy', color: 'signal-violet' }]}
        />
        <p className="text-xs text-slate-400">The two curves cross at the signal intensity — Eve can always fake one intensity. She cannot fake the whole curve, and Bob does not know which pulse was which.</p>
      </LabSection>
    </div>
  )
}

// --- Twin-field QKD ----------------------------------------------------------------

export function TfLab() {
  const [L, setL] = useState(300)
  const [dark, setDark] = useState('1e-8')
  const [dphi, setDphi] = useState(0)
  const opts = { dark: Number(dark) }
  const data = useMemo(
    () =>
      range(61).map((k) => {
        const d = k * 10
        const nz = (v) => (v > 0 ? v : null)
        return { L: d, plob: plob(channelEta(d)), bb84: nz(bb84Rate(d, opts)), tf: nz(tfRate(d, opts)) }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dark],
  )
  const reach = (f) => (data.filter((p) => p[f]).at(-1)?.L ?? 0)
  const beats = data.find((p) => p.tf && p.tf > p.plob)?.L
  const p0 = tfFringe((dphi * Math.PI) / 180)
  return (
    <div className="space-y-4">
      <LabSection title="Key rate vs. distance (bits per pulse, log scale)">
        <div className="grid gap-4 md:grid-cols-2">
          <Slider label="Distance" unit=" km" value={L} min={0} max={600} step={10} onChange={setL} />
          <div>
            <p className="mb-1 text-[11px] text-slate-400">Detector dark-count probability</p>
            <Tabs value={dark} onChange={setDark} tabs={['1e-9', '1e-8', '1e-7'].map((v) => ({ value: v, label: v.replace('1e', '10^') }))} />
          </div>
        </div>
        <LineChartBox
          data={data}
          x="L"
          yLog
          yDomain={[1e-12, 1]}
          xLabel="fibre length (km)"
          yLabel="bits / pulse"
          series={[{ key: 'plob', label: 'PLOB bound (no repeater can beat)', color: 'signal-rose', dashed: true }, { key: 'bb84', label: 'BB84 (∝ η)' }, { key: 'tf', label: 'TF-QKD (∝ √η)', color: 'signal-green' }]}
          refLines={[{ x: L, label: `${L} km`, color: 'signal-amber' }]}
          height={260}
        />
        <Stats>
          <Stat label="Transmittance η" value={channelEta(L).toExponential(1)} />
          <Stat label="BB84 reach" value={`${reach('bb84')} km`} />
          <Stat label="TF-QKD reach" value={`${reach('tf')} km`} tone="green" />
          <Stat label="TF beats PLOB beyond" value={beats !== undefined ? `${beats} km` : '—'} tone="violet" />
        </Stats>
        <Note>Toy model: ideal single photons and error correction, 0.2 dB/km fibre, 30% detectors. Only the slopes are the point — real systems sit lower, but TF-QKD has exceeded the PLOB bound experimentally (over 800 km in 2023).</Note>
      </LabSection>
      <LabSection title="At the middle station: one photon, two paths">
        <Slider label="Phase difference between Alice’s and Bob’s pulses" value={dphi} min={0} max={360} step={5} onChange={setDphi} />
        <BarChartBox data={[{ d: 'detector D0', p: p0 }, { d: 'detector D1', p: 1 - p0 }]} x="d" series={[{ key: 'p', label: 'click probability' }]} yDomain={[0, 1]} height={160} />
        <p className="text-xs text-slate-400">
          Which detector clicks depends only on the <em>difference</em> of the two phases — the middle station learns whether Alice’s and Bob’s choices agree, not what they are. That is why it need not be trusted, and why the two lasers must stay phase-locked.
        </p>
      </LabSection>
    </div>
  )
}

// --- CV-QKD -----------------------------------------------------------------------

export function CvLab() {
  const [VA, setVA] = useState(10)
  const [L, setL] = useState(20)
  const [xi, setXi] = useState(0.01)
  const [beta, setBeta] = useState(0.95)
  const T = 10 ** (-0.02 * L)
  const r = cvRate({ VA, T, xi, beta })
  const curve = range(41).map((k) => {
    const d = k * 2.5
    const t = 10 ** (-0.02 * d)
    const K = cvRate({ VA, T: t, xi, beta }).K
    return { L: d, K: K > 0 ? K : null, plob: plob(t) }
  })
  const reach = curve.filter((p) => p.K).at(-1)?.L ?? 0
  const pts = useMemo(() => cvSamples({ VA, T, xi, n: 260 }).map((s) => ({ x: s.xa, y: s.xb })), [VA, T, xi])
  return (
    <div className="space-y-4">
      <LabSection title="Gaussian-modulated coherent states">
        <div className="grid gap-3 md:grid-cols-2">
          <Slider label="Modulation variance V_A" unit=" SNU" value={VA} min={1} max={40} step={1} onChange={setVA} />
          <Slider label="Fibre length" unit=" km" value={L} min={0} max={100} step={1} onChange={setL} />
          <Slider label="Excess noise ξ" unit=" SNU" value={xi} min={0} max={0.1} step={0.005} onChange={setXi} />
          <Slider label="Reconciliation efficiency β" unit="" value={beta} min={0.85} max={1} step={0.01} onChange={setBeta} />
        </div>
        <Stats>
          <Stat label="Transmittance T" value={T.toFixed(3)} />
          <Stat label="Alice–Bob info I_AB" value={`${r.IAB.toFixed(3)} b`} tone="cyan" />
          <Stat label="Eve’s bound χ_BE" value={`${r.chiBE.toFixed(3)} b`} tone="rose" />
          <Stat label="Key K = βI − χ" value={`${r.K.toFixed(4)} b`} tone={r.K > 0 ? 'green' : 'rose'} />
        </Stats>
        <Note tone={r.K > 0 ? 'green' : 'rose'}>
          {r.K > 0 ? `Positive key: up to ~${reach} km with these settings.` : 'Eve could know more than Bob shares with Alice — no secure key. Reduce noise or distance, or improve β.'}
        </Note>
      </LabSection>
      <div className="grid gap-4 lg:grid-cols-2">
        <LabSection title="What Bob measures vs. what Alice sent">
          <ScatterBox groups={[{ label: 'pulses', points: pts }]} xLabel="Alice’s x_A" yLabel="Bob’s x_B" height={240} />
          <p className="text-[10px] text-slate-500">Correlated, but blurred by shot noise (unavoidable) plus excess noise ξ (blamed on Eve). Slope = √T.</p>
        </LabSection>
        <LabSection title="Key rate vs. distance">
          <LineChartBox data={curve} x="L" yLog yDomain={[1e-5, 10]} xLabel="km" yLabel="bits / pulse" series={[{ key: 'K', label: 'CV-QKD key' }, { key: 'plob', label: 'PLOB bound', color: 'signal-rose', dashed: true }]} refLines={[{ x: L, label: `${L} km`, color: 'signal-amber' }]} height={240} />
        </LabSection>
      </div>
      <Note>Asymptotic secret-key rate for collective Gaussian attacks with reverse reconciliation and an ideal homodyne detector (Lodewyck et al. 2007). Excess noise and β set the reach: try ξ = 0.05 or β = 0.90.</Note>
    </div>
  )
}
