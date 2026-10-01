import { bitOf, cx, gate, onEach, range } from './shared'

const N = 3
const INPUTS = range(N)
const ANCILLA = N

export default {
  id: 'bernstein-vazirani',
  track: 'algorithm',
  group: 'oracle',
  dir: { problem: 'Learning a hidden bit string', advantage: 'Polynomial (linear to O(1))', mechanism: 'Quantum superposition, phase kickback' },
  keyIdea:
    'The oracle multiplies input x by (−1)^{s·x}. That pattern of signs is exactly what a Hadamard turns back into the string s — so the secret is read out directly, all bits in one query.',
  limits: 'Classically you need n queries (one per bit); the gain is n → 1, not exponential.',
  flow: [
    { lane: 'Quantum computer', title: 'Superpose every input', text: 'Hadamards on n inputs; answer qubit in |−⟩.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'One oracle call', text: 'Each input picks up the sign (−1)^{s·x}.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Hadamard the inputs', text: 'The sign pattern turns into the bitstring s.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Measure', text: 'Reads s exactly.', kind: 'measure' },
  ],
  name: 'Bernstein–Vazirani',
  level: 'Intermediate',
  category: 'Oracle',
  speedup: 'Linear → 1 query',
  summary: 'Recover a hidden bitstring s from a function f(x) = s·x in one query instead of n.',
  analogy:
    'A safe that only answers "odd or even number of your chosen dials match the code". Classically you test one dial per question. Quantumly, one question returns the entire code.',
  queries: { classical: N, quantum: 1, note: 'function calls for a 3-bit secret' },
  params: [
    {
      key: 'secret',
      label: 'Secret string s',
      options: range(2 ** N).map((v) => {
        const bits = v.toString(2).padStart(N, '0')
        return { value: bits, label: bits }
      }),
      default: '101',
    },
  ],
  build({ secret }) {
    const oracle = INPUTS.filter((q) => bitOf(secret, q)).map((q) => cx(q, ANCILLA))
    return {
      qubits: N + 1,
      labels: ['x0', 'x1', 'x2', 'out'],
      readout: INPUTS,
      steps: [
        {
          title: 'Output qubit to |−⟩',
          gates: [gate('x', ANCILLA), gate('h', ANCILLA)],
          narration: 'Same trick as Deutsch–Jozsa: an output qubit in |−⟩ turns "compute f(x)" into "flip the sign when f(x)=1".',
        },
        {
          title: 'All inputs at once',
          gates: onEach('h', INPUTS),
          narration: 'Every 3-bit input is now in play with equal weight.',
        },
        {
          title: 'One oracle call',
          gates: oracle,
          narration: `The oracle computes f(x) = s·x mod 2 using a CNOT from each input bit where s has a 1 (here s = ${secret}). Each CNOT kicks a sign back onto its input qubit — so the secret gets written into the inputs’ phases, one qubit at a time.`,
          math: '(−1)^{s·x} = Π_i (−1)^{s_i x_i}  — a product of single-qubit phases',
        },
        {
          title: 'Read the phases',
          gates: onEach('h', INPUTS),
          narration:
            'A Hadamard turns |+⟩ back into |0⟩ and |−⟩ into |1⟩. Each input qubit whose sign was flipped becomes 1. The register now holds s itself — watch the mini spheres point straight up or down.',
        },
      ],
      answer: { bits: [secret], text: `Inputs read ${secret} = s, every time.` },
    }
  },
}
