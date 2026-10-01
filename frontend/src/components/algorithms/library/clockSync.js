import { cx, gate } from './shared'

const PHASES = { 0: '0', 20: '20°', 30: '30°', 60: '60°' }

export default {
  id: 'clock-sync',
  track: 'protocol',
  group: 'characterization',
  dir: { domain: 'Metrology / Networking', function: 'Synchronizing distant clocks beyond classical limits', resource: 'Shared entanglement' },
  name: 'Quantum Clock Sync',
  level: 'Intermediate',
  category: 'Metrology',
  speedup: '√N better precision',
  summary: 'A clock offset shows up as a phase on every qubit. N independent qubits estimate it with error 1/√N; N qubits in a GHZ state accumulate N times the phase and reach 1/N — the Heisenberg limit.',
  delivers: 'Clock comparison (and so synchronisation) more precise than N independent measurements allow.',
  analogy:
    'N people each count a drum’s beats and average their guesses — errors shrink like 1/√N. If instead they link arms so they all sway as one, the group’s sway amplifies the rhythm N-fold and the error shrinks like 1/N.',
  keyIdea:
    'A time offset Δt at frequency ω gives phase φ = ωΔt. One qubit: (|0⟩ + e^{iφ}|1⟩)/√2, fringe cos²(φ/2). GHZ of N qubits: (|0…0⟩ + e^{iNφ}|1…1⟩)/√2, fringe cos²(Nφ/2) — N times steeper, so the same number of runs pins φ down N times better than √N independent ones.',
  limits: 'Shows the metrology core of entanglement-assisted clock protocols (e.g. Jozsa et al. 2000, Kómár et al. 2014). Real networks must also distribute the GHZ state and handle decoherence, which shrinks the gain.',
  lab: 'clock-sync',
  lanes: ['Clock A', 'Clock B'],
  flow: [
    { lane: 'Clock A', title: 'Share a GHZ / Bell state', text: 'Between the clocks to compare.', kind: 'quantum' },
    { lane: 'Clock B', title: 'Each qubit ticks with its clock', text: 'Offset → phase φ per qubit.', kind: 'quantum', via: 'quantum' },
    { lane: 'Clock A', title: 'Disentangle, measure parity', text: 'Fringe cos²(Nφ/2).', kind: 'measure', via: 'quantum', loop: 'M runs' },
    { lane: 'Clock A', title: 'Estimate φ, correct the clock', text: 'Error ≈ 1/(N√M) instead of 1/√(NM).', kind: 'classical' },
  ],
  params: [{ key: 'phi', label: 'Phase per qubit (clock offset)', options: Object.entries(PHASES).map(([value, label]) => ({ value, label })), default: '20' }],
  build({ phi }) {
    const p = (Number(phi) * Math.PI) / 180
    const p0 = Math.cos((3 * p) / 2) ** 2
    const single = Math.cos(p / 2) ** 2
    return {
      qubits: 3,
      labels: ['q0', 'q1', 'q2'],
      readout: [0],
      steps: [
        { title: 'Make GHZ', gates: [gate('h', 0), cx(0, 1), cx(0, 2)], narration: '(|000⟩ + |111⟩)/√2 — the three qubits act as one big "superclock".' },
        { title: `Each qubit gains phase ${PHASES[phi]}`, gates: [0, 1, 2].map((q) => ({ g: 'p', t: [q], angle: p })), narration: `The |111⟩ branch picks up 3× the phase: e^{i·3·${PHASES[phi]}}. Watch its bar change colour 3× as fast as one qubit would.` },
        { title: 'Disentangle and read', gates: [cx(0, 2), cx(0, 1), gate('h', 0)], narration: `P(0) on q0 = cos²(3φ/2) = ${p0.toFixed(3)}. A single unentangled qubit would give cos²(φ/2) = ${single.toFixed(3)} — a much flatter, less sensitive fringe.` },
      ],
      answer: { text: `P(0) = ${p0.toFixed(3)} (single qubit: ${single.toFixed(3)}).`, check: (d) => Math.abs((d['0'] ?? 0) - p0) < 1e-9 },
    }
  },
}
