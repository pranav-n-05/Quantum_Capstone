import { cx, gate } from './shared'

const VARIANTS = {
  'phi+': { label: '|Φ⁺⟩ = (|00⟩ + |11⟩)/√2', prep: [], answer: ['00', '11'] },
  'phi-': { label: '|Φ⁻⟩ = (|00⟩ − |11⟩)/√2', prep: [gate('x', 0)], answer: ['00', '11'] },
  'psi+': { label: '|Ψ⁺⟩ = (|01⟩ + |10⟩)/√2', prep: [gate('x', 1)], answer: ['01', '10'] },
  'psi-': { label: '|Ψ⁻⟩ = (|01⟩ − |10⟩)/√2', prep: [gate('x', 0), gate('x', 1)], answer: ['01', '10'] },
}

export default {
  id: 'bell',
  track: 'protocol',
  group: 'foundations',
  dir: { domain: 'Foundations', function: 'Creating a maximally entangled pair (the ebit every protocol spends)', resource: 'Hadamard + CNOT' },
  keyIdea:
    'H makes q0 undecided; CNOT copies that indecision onto q1. The pair now has one shared state and neither qubit has a state of its own — the arrows on both spheres vanish.',
  limits: 'Not in the directory PDF: included as the foundation the communication protocols are built on.',
  flow: [
    { lane: 'Source', title: 'Two qubits in |00⟩', text: 'Independent, both definite.', kind: 'quantum' },
    { lane: 'Source', title: 'Hadamard on q0', text: 'q0 becomes (|0⟩ + |1⟩)/√2.', kind: 'quantum' },
    { lane: 'Source', title: 'CNOT q0 → q1', text: 'Result: (|00⟩ + |11⟩)/√2.', kind: 'quantum' },
    { lane: 'Alice', title: 'Alice keeps q0', text: 'Her half alone is a fair coin.', kind: 'quantum', via: 'quantum' },
    { lane: 'Bob', title: 'Bob gets q1', text: 'His too — but the two coins always agree.', kind: 'quantum', via: 'quantum' },
  ],
  delivers: 'One shared ebit — the fuel the other two protocols burn.',
  parties: [
    { qubit: 'q0', who: 'Alice', role: 'keeps this half' },
    { qubit: 'q1', who: 'Bob', role: 'carries this half away' },
  ],
  cost: { ebits: '+1 made', qubitsSent: 1, classicalBits: 0, note: 'One qubit must physically travel once, to put the pair in two places.' },
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
