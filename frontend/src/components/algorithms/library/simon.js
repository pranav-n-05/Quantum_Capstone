import { dot2 } from '../../../quantum/numeric'
import { cx, onEach, range, toBits } from './shared'

const INPUTS = range(3)
const OUTPUTS = [3, 4, 5]
const SECRETS = ['110', '101', '011', '111']

/**
 * f(x) = x ⊕ (x_j · s) where j is the lowest set bit of s: copying x and then
 * conditionally XOR-ing s makes f two-to-one with f(x) = f(x ⊕ s).
 */
function oracle(s) {
  const value = parseInt(s, 2)
  const j = INPUTS.find((q) => (value >> q) & 1)
  return [...INPUTS.map((q) => cx(q, OUTPUTS[q])), ...INPUTS.filter((q) => (value >> q) & 1).map((q) => cx(j, OUTPUTS[q]))]
}

export default {
  id: 'simon',
  track: 'algorithm',
  group: 'oracle',
  dir: { problem: 'Period finding in 2-to-1 functions', advantage: 'Exponential', mechanism: 'Interference, QFT' },
  name: "Simon's Algorithm",
  level: 'Intermediate',
  category: 'Oracle',
  speedup: 'Exponential',
  summary: 'Find the hidden XOR-period s of a function with f(x) = f(x ⊕ s), using about n queries instead of ~2^{n/2}.',
  analogy:
    'Every key in a building opens exactly two doors, and the two doors always differ by the same secret pattern. Each quantum query hands you one equation the pattern must satisfy; a handful of equations pins it down.',
  keyIdea:
    'After the query, inputs x and x ⊕ s carry the same output, so they interfere. The final Hadamards only let through strings y with y·s = 0 (mod 2). Collect n−1 independent such y and solve the linear system for s.',
  limits: 'Historically the first exponential oracle separation — it inspired Shor. Real uses are limited; it breaks some symmetric-key constructions only under a "quantum query" access model.',
  lab: 'simon',
  queries: { classical: 5, quantum: 2, note: 'birthday-style classical search vs. ~n−1 quantum queries, 3-bit input' },
  flow: [
    { lane: 'Quantum computer', title: 'Hadamard the inputs', text: 'All 2ⁿ inputs at once; outputs start at |0⟩.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'One oracle call', text: 'Computes |x⟩|f(x)⟩ — pairs x, x⊕s share an output.', kind: 'quantum', loop: '≈ n−1 times' },
    { lane: 'Quantum computer', title: 'Hadamard the inputs, measure', text: 'Get a random y with y·s = 0.', kind: 'measure', loop: '≈ n−1 times' },
    { lane: 'Classical computer', title: 'Enough independent y?', text: 'Need n−1 linearly independent equations.', kind: 'decision', via: 'classical' },
    { lane: 'Classical computer', title: 'Gaussian elimination (mod 2)', text: 'The non-zero solution is s.', kind: 'classical' },
  ],
  params: [
    {
      key: 'secret',
      label: 'Hidden period s',
      options: SECRETS.map((s) => ({ value: s, label: s })),
      default: '110',
    },
  ],
  build({ secret }) {
    const s = parseInt(secret, 2)
    const allowed = range(8).filter((y) => dot2(y, s) === 0).map((y) => toBits(y, 3))
    return {
      qubits: 6,
      labels: ['x0', 'x1', 'x2', 'f0', 'f1', 'f2'],
      readout: INPUTS,
      steps: [
        { title: 'Superpose every input', gates: onEach('h', INPUTS), narration: 'All 8 inputs at once. The output register stays |000⟩ for now.' },
        {
          title: 'Query f once',
          gates: oracle(secret),
          narration: `Now |x⟩|f(x)⟩ for every x. Because f(x) = f(x ⊕ ${secret}), each output value is shared by exactly two inputs — look at the amplitude bars, they come in pairs.`,
          math: `f(x) = f(x ⊕ ${secret})`,
        },
        {
          title: 'Hadamard the inputs',
          gates: onEach('h', INPUTS),
          narration: `Each pair x, x⊕s interferes. Only strings y with y·s = 0 (mod 2) survive: ${allowed.join(', ')}. One measurement gives one such y — one linear equation for s.`,
          math: 'y · s ≡ 0 (mod 2)',
        },
      ],
      answer: { bits: allowed, text: `Input register reads one of ${allowed.join(', ')} — all orthogonal to s = ${secret}.` },
    }
  },
}
