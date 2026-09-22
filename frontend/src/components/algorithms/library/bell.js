import { cx, gate } from './shared'

const VARIANTS = {
  'phi+': { label: '|Φ⁺⟩ = (|00⟩ + |11⟩)/√2', prep: [], answer: ['00', '11'] },
  'phi-': { label: '|Φ⁻⟩ = (|00⟩ − |11⟩)/√2', prep: [gate('x', 0)], answer: ['00', '11'] },
  'psi+': { label: '|Ψ⁺⟩ = (|01⟩ + |10⟩)/√2', prep: [gate('x', 1)], answer: ['01', '10'] },
  'psi-': { label: '|Ψ⁻⟩ = (|01⟩ − |10⟩)/√2', prep: [gate('x', 0), gate('x', 1)], answer: ['01', '10'] },
}

export default {
  id: 'bell',
  name: 'Bell State',
  level: 'Beginner',
  category: 'Entanglement',
  speedup: 'Foundation',
  summary: 'Two gates turn two independent qubits into one shared, inseparable state.',
  analogy:
    'Two coins minted as a pair: flip either one anywhere in the universe and it lands the same way as its twin — yet neither coin had a face picked in advance.',
  params: [
    {
      key: 'variant',
      label: 'Bell state',
      options: Object.entries(VARIANTS).map(([value, v]) => ({ value, label: v.label })),
      default: 'phi+',
    },
  ],
  build({ variant }) {
    const v = VARIANTS[variant]
    const steps = []
    if (v.prep.length) {
      steps.push({
        title: 'Choose which Bell state',
        gates: v.prep,
        narration:
          'An X flips a qubit from |0⟩ to |1⟩. Starting from a different corner decides which of the four Bell states comes out — the recipe after this is identical for all four.',
      })
    }
    steps.push(
      {
        title: 'Superposition',
        gates: [gate('h', 0)],
        narration:
          'The Hadamard puts q0 halfway between 0 and 1. Watch its Bloch arrow swing onto the equator: it is still a single, pure state — just an undecided one.',
        math: 'H|0⟩ = (|0⟩ + |1⟩)/√2',
      },
      {
        title: 'Entangle',
        gates: [cx(0, 1)],
        narration:
          'CNOT flips q1 only where q0 is 1. Now the two qubits share one state that cannot be written as "q0 is this, q1 is that". Look at the mini spheres: both arrows shrink to the centre. Each qubit on its own is a perfect coin flip; all the information lives in the correlation.',
        math: 'for Φ⁺:  (|00⟩ + |01⟩)/√2  →  (|00⟩ + |11⟩)/√2   (bitstrings read q1 q0)',
      },
    )
    return {
      qubits: 2,
      labels: ['q0', 'q1'],
      readout: [0, 1],
      steps,
      answer: { bits: v.answer, text: `Only ${v.answer.join(' or ')} — never mixed, always 50/50.` },
    }
  },
}
