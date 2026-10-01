import { expectHamiltonian } from '../../../quantum/pauli'
import { exactGroundEnergy, H2_TERMS, runVqe, vqeAnsatzOps } from '../../../quantum/labs/variational'

const START = 0.2
const trace = runVqe({ theta0: START, iterations: 40 })
const OPTIMUM = trace.at(-1).theta
const EXACT = exactGroundEnergy()

const PRESETS = {
  start: { label: `θ = ${START.toFixed(2)} (first guess)`, theta: START },
  mid: { label: `θ = ${trace[3].theta.toFixed(2)} (after 3 steps)`, theta: trace[3].theta },
  opt: { label: `θ = ${OPTIMUM.toFixed(3)} (optimised)`, theta: OPTIMUM },
}

export default {
  id: 'vqe',
  track: 'algorithm',
  group: 'variational',
  dir: { problem: 'Finding ground state energy of molecules', advantage: 'Heuristic / Near-term', mechanism: 'Hybrid quantum-classical optimization' },
  name: 'VQE (Variational)',
  level: 'Intermediate',
  category: 'Variational',
  speedup: 'Heuristic',
  summary: 'Find a molecule’s lowest energy by letting a classical optimiser tune a short quantum circuit until the measured energy stops falling.',
  analogy:
    'Tuning a guitar string by ear: the quantum computer plays the note (prepares a trial state and measures its energy), the classical computer turns the peg (adjusts θ), and you stop when it cannot get any lower.',
  keyIdea:
    'The variational principle: ⟨ψ(θ)|H|ψ(θ)⟩ is never below the true ground energy. So minimising the measured energy over θ can only approach the answer from above. The quantum chip only has to prepare and measure — short circuits that tolerate noise.',
  limits:
    'H₂ here needs one parameter; real molecules need many, and optimisers can stall on "barren plateaus". No proven speedup — VQE is a near-term heuristic. Energies are exact expectation values (no shot noise) unless you add it in the Lab.',
  lab: 'vqe',
  flow: [
    { lane: 'Classical computer', title: 'Write H as Pauli terms', text: 'H₂ → 5 terms: II, IZ, ZI, ZZ, XX.', kind: 'classical' },
    { lane: 'Classical computer', title: 'Guess θ', text: 'Starting parameters.', kind: 'classical' },
    { lane: 'Quantum computer', title: 'Prepare |ψ(θ)⟩', text: 'Short ansatz circuit.', kind: 'quantum', via: 'classical', loop: 'each iteration' },
    { lane: 'Quantum computer', title: 'Measure each Pauli term', text: 'Many shots per term → ⟨H⟩.', kind: 'measure', loop: 'each iteration' },
    { lane: 'Classical computer', title: 'Update θ', text: 'Gradient from the parameter-shift rule.', kind: 'classical', via: 'classical', loop: 'each iteration' },
    { lane: 'Classical computer', title: 'Converged?', text: 'Energy change below tolerance → done.', kind: 'decision' },
  ],
  params: [
    {
      key: 'theta',
      label: 'Ansatz angle',
      options: Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label })),
      default: 'opt',
    },
  ],
  build({ theta }) {
    const t = PRESETS[theta].theta
    const [ry, cxOp, x] = vqeAnsatzOps(t)
    return {
      qubits: 2,
      labels: ['q0', 'q1'],
      readout: [0, 1],
      steps: [
        {
          title: `Ry(${t.toFixed(3)}) on q1`,
          gates: [ry],
          narration: 'One rotation sets how much the two electron configurations mix. θ is the only knob the optimiser turns.',
        },
        { title: 'Entangle', gates: [cxOp], narration: 'CNOT copies the choice onto q0: cos(θ/2)|00⟩ + sin(θ/2)|11⟩.' },
        {
          title: 'Map to the right configurations',
          gates: [x],
          narration: 'X on q0 gives cos(θ/2)|01⟩ + sin(θ/2)|10⟩ — the two configurations the XX term of H₂ couples.',
        },
        {
          title: 'Measure the energy',
          gates: [],
          narration: `⟨H⟩ at this θ is computed from the five Pauli terms. Exact ground energy: ${EXACT.toFixed(5)} Ha. See the Lab tab for the optimiser converging.`,
          math: 'E(θ) = Σ cₖ ⟨ψ(θ)|Pₖ|ψ(θ)⟩ ≥ E₀',
        },
      ],
      answer: {
        text: theta === 'opt' ? `Energy within chemical accuracy of the exact ${EXACT.toFixed(4)} Ha.` : 'Energy is above the ground state — keep optimising.',
        check: (dist, final) => {
          const e = expectHamiltonian(final, H2_TERMS)
          return e >= EXACT - 1e-9 && (theta !== 'opt' || e - EXACT < 1.6e-3)
        },
      },
    }
  },
}
