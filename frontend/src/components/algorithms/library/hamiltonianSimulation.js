import { exactState, infidelity, trotterStep } from '../../../quantum/labs/hamsim'
import { applyOps, zeroState } from '../../../quantum/statevector'
import { range } from './shared'

const J = 1
const H = 1
const T = 1.5

export default {
  id: 'hamiltonian-simulation',
  track: 'algorithm',
  group: 'simulation',
  dir: { problem: 'Simulating quantum system evolution', advantage: 'Exponential', mechanism: 'Lie-Trotter product formula, LCU' },
  name: 'Hamiltonian Simulation',
  level: 'Intermediate',
  category: 'Simulation',
  speedup: 'Exponential',
  summary: 'Run e^{−iHt} — how a physical system evolves — by chopping time into small slices and applying each piece of H in turn.',
  analogy:
    'Walking a diagonal across a city grid: you cannot go diagonally, so you alternate short east and north hops. The shorter the hops, the closer you stay to the straight line. Trotter steps are those hops; H’s non-commuting terms are the two directions.',
  keyIdea:
    'e^{−i(A+B)t} ≈ (e^{−iAt/n} e^{−iBt/n})ⁿ with error O(t²/n). Each factor is a simple gate. Classically the state of n spins needs 2ⁿ numbers; the quantum circuit needs only n qubits and poly(n) gates — Feynman’s original reason for quantum computers.',
  limits: 'Two spins here (exactly solvable, so the error can be shown). LCU and qubitisation reach better scaling than Trotter; they are named, not simulated.',
  lab: 'hamiltonian-simulation',
  flow: [
    { lane: 'Classical computer', title: 'Split H = A + B', text: 'Here A = J·Z₀Z₁, B = h·(X₀ + X₁).', kind: 'classical' },
    { lane: 'Classical computer', title: 'Choose n slices', text: 'Error ∝ t²/n (first order).', kind: 'classical' },
    { lane: 'Quantum computer', title: 'e^{−iA·t/n}', text: 'CNOT · Rz · CNOT.', kind: 'quantum', via: 'classical', loop: 'n times' },
    { lane: 'Quantum computer', title: 'e^{−iB·t/n}', text: 'Rx on each spin.', kind: 'quantum', loop: 'n times' },
    { lane: 'Quantum computer', title: 'Measure observables', text: 'Magnetisation, correlations, energies…', kind: 'measure' },
  ],
  params: [{ key: 'n', label: `Trotter steps (t = ${T})`, options: [1, 2, 4, 8].map((n) => ({ value: String(n), label: String(n) })), default: '4' }],
  build({ n }) {
    const steps = Number(n)
    const dt = T / steps
    const ops = range(steps).map(() => trotterStep(J, H, dt))
    const final = applyOps(zeroState(2), ops.flat())
    const err = infidelity(exactState(J, H, T), final)
    return {
      qubits: 2,
      labels: ['s0', 's1'],
      readout: [0, 1],
      steps: ops.map((g, k) => ({
        title: `Slice ${k + 1}/${steps}`,
        gates: g,
        narration:
          k === steps - 1
            ? `Done: the infidelity with the exact e^{−iHt}|00⟩ is ${err.toExponential(2)}. Double the slices and it drops about 4×.`
            : `Apply e^{−iJ·Z₀Z₁·dt} (CNOT–Rz–CNOT) then e^{−ih·(X₀+X₁)·dt} (two Rx), with dt = ${dt.toFixed(3)}.`,
        math: 'e^{−iHt} ≈ (e^{−iA·dt} e^{−iB·dt})ⁿ',
      })),
      answer: {
        text: `Infidelity vs exact: ${err.toExponential(2)}.`,
        // One slice is meant to be crude; from 4 slices on it must be close.
        check: (d, f) => Math.abs(infidelity(exactState(J, H, T), f) - err) < 1e-12 && (steps < 4 || err < 0.05),
      },
    }
  },
}
