import { cx, gate, onEach, range } from './shared'

const INPUTS = range(3)
const ANCILLA = 3

const ORACLES = {
  'constant-0': { label: 'Constant: f(x) = 0', ops: [], constant: true },
  'constant-1': { label: 'Constant: f(x) = 1', ops: [gate('x', ANCILLA)], constant: true },
  'balanced-x0': { label: 'Balanced: f(x) = x₀', ops: [cx(0, ANCILLA)], constant: false },
  'balanced-parity': {
    label: 'Balanced: f(x) = x₀ ⊕ x₁ ⊕ x₂',
    ops: INPUTS.map((q) => cx(q, ANCILLA)),
    constant: false,
  },
}

export default {
  id: 'deutsch-jozsa',
  track: 'algorithm',
  name: 'Deutsch–Jozsa',
  level: 'Intermediate',
  category: 'Oracle',
  speedup: 'Exponential (exact)',
  summary: 'Decide whether a black-box function is constant or balanced with a single query.',
  analogy:
    'A sealed box of 8 light bulbs, either all the same colour or exactly half red. Classically you may need to check 5. Quantumly you shine one beam through all 8 at once and see whether the reflections cancel out.',
  queries: { classical: 5, quantum: 1, note: 'worst-case function calls, 3-bit input' },
  params: [
    {
      key: 'oracle',
      label: 'Hidden function',
      options: Object.entries(ORACLES).map(([value, o]) => ({ value, label: o.label })),
      default: 'balanced-parity',
    },
  ],
  build({ oracle }) {
    const o = ORACLES[oracle]
    return {
      qubits: 4,
      labels: ['x0', 'x1', 'x2', 'out'],
      readout: INPUTS,
      steps: [
        {
          title: 'Prepare the answer qubit',
          gates: [gate('x', ANCILLA)],
          narration: 'The output qubit starts in |1⟩. After the next Hadamard it becomes |−⟩ — the ingredient for "phase kickback".',
        },
        {
          title: 'Ask every question at once',
          gates: onEach('h', [...INPUTS, ANCILLA]),
          narration:
            'Hadamards on the inputs make an equal superposition of all 8 inputs. The amplitude bars flatten out: one query will now touch every input simultaneously.',
        },
        {
          title: 'Query the oracle (once)',
          gates: o.ops,
          narration: o.constant
            ? 'The oracle computes f(x) into the output qubit. Because the output is |−⟩, f(x)=1 would flip the sign of that input’s amplitude instead. This function is constant, so every input gets the same sign — watch the bar colours stay uniform.'
            : 'The oracle computes f(x) into the output qubit. Because the output is |−⟩, every input with f(x)=1 has its amplitude sign flipped instead ("phase kickback"). This function is balanced, so exactly half the bars change colour.',
          math: '|x⟩|−⟩  →  (−1)^{f(x)} |x⟩|−⟩',
        },
        {
          title: 'Interfere',
          gates: onEach('h', INPUTS),
          narration: o.constant
            ? 'Hadamards on the inputs again. With all signs equal, every path leads back to |000⟩ and everything else cancels. Reading 000 means "constant".'
            : 'Hadamards on the inputs again. With half the signs flipped, the paths into |000⟩ cancel exactly, so 000 has zero probability. Any other reading means "balanced".',
          math: 'P(000) = |(1/8) Σₓ (−1)^{f(x)}|²  = 1 if constant, 0 if balanced',
        },
      ],
      answer: o.constant
        ? { bits: ['000'], text: 'Inputs read 000 → constant.' }
        : { notBits: ['000'], text: 'Inputs never read 000 → balanced.' },
    }
  },
}
