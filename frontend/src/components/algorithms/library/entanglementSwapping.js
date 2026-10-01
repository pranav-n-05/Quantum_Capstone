import { cx, gate } from './shared'

const [A, B1, B2, C] = [0, 1, 2, 3]

export default {
  id: 'entanglement-swapping',
  track: 'protocol',
  group: 'communication',
  dir: { domain: 'Quantum Networking', function: 'Entangling two particles that never interacted', resource: 'Bell-state measurements, Teleportation' },
  name: 'Entanglement Swapping',
  level: 'Intermediate',
  category: 'Networking',
  speedup: 'Basis of quantum repeaters',
  summary: 'Two separate Bell pairs, A–B₁ and B₂–C. A Bell measurement on B₁B₂ in the middle leaves A and C entangled, though they never met.',
  delivers: 'Entanglement between two distant nodes, built from two short links.',
  parties: [
    { qubit: 'A', who: 'Alice', role: 'end node' },
    { qubit: 'B1', who: 'Relay', role: 'half of pair A–B₁' },
    { qubit: 'B2', who: 'Relay', role: 'half of pair B₂–C' },
    { qubit: 'C', who: 'Charlie', role: 'end node' },
  ],
  cost: { ebits: 2, qubitsSent: 2, classicalBits: 2, note: 'Two short-range ebits are consumed to make one long-range ebit; the relay phones 2 bits to an end node.' },
  analogy:
    'Two pairs of twins. A matchmaker in the middle introduces one twin from each pair in a special way — and the two twins left at home, who never met, end up acting like twins of each other.',
  keyIdea:
    'It is teleportation applied to half of an entangled pair: the relay teleports B₁’s state onto C. Since B₁ was entangled with A, after the corrections C is entangled with A.',
  limits: 'The corrections are applied as controlled gates (deferred measurement). Real repeaters also need entanglement purification and quantum memories.',
  lanes: ['Alice', 'Relay', 'Charlie'],
  flow: [
    { lane: 'Alice', title: 'Pair A–B₁', text: 'B₁ goes to the relay.', kind: 'quantum' },
    { lane: 'Charlie', title: 'Pair B₂–C', text: 'B₂ goes to the relay.', kind: 'quantum' },
    { lane: 'Relay', title: 'Bell measurement on B₁, B₂', text: '2 classical bits.', kind: 'measure', via: 'quantum' },
    { lane: 'Charlie', title: 'Pauli correction on C', text: 'Using the relay’s 2 bits.', kind: 'quantum', via: 'classical' },
    { lane: 'Alice', title: 'A and C share a Bell pair', text: 'They never interacted.', kind: 'quantum' },
  ],
  params: [{ key: 'basis', label: 'Check A, C in basis', options: [{ value: 'Z', label: 'Z' }, { value: 'X', label: 'X' }], default: 'Z' }],
  build({ basis }) {
    return {
      qubits: 4,
      labels: ['A', 'B1', 'B2', 'C'],
      readout: [A, C],
      steps: [
        { title: 'Make pairs A–B₁ and B₂–C', gates: [gate('h', A), cx(A, B1), gate('h', B2), cx(B2, C)], narration: 'Two independent Bell pairs. A and C have nothing to do with each other yet.' },
        { title: 'Relay: Bell measurement on B₁, B₂', gates: [cx(B1, B2), gate('h', B1)], narration: 'CNOT then H turns the Bell basis into the computational basis — what the relay measures.' },
        {
          title: 'Charlie applies the correction',
          gates: [cx(B2, C), { g: 'z', t: [C], c: [B1] }],
          narration: 'X if the relay’s second bit is 1, Z if the first is 1 (done here as controlled gates). B₁ and B₂ end up unentangled; A and C are now a Bell pair.',
          math: 'A–C: (|00⟩ + |11⟩)/√2',
        },
        ...(basis === 'X' ? [{ title: 'Measure A and C in X', gates: [gate('h', A), gate('h', C)], narration: 'A Bell pair is correlated in every basis, not just Z — this is what distinguishes entanglement from shared classical randomness.' }] : []),
      ],
      answer: { bits: ['00', '11'], text: `A and C always agree in ${basis} — 00 or 11, 50/50.` },
    }
  },
}
