import { cswap, gate, ry } from './shared'

const PAIRS = {
  same: { label: 'x = x′ (identical)', a: 1.0, b: 1.0 },
  close: { label: 'x, x′ close (Δ = 0.6)', a: 0.8, b: 1.4 },
  far: { label: 'x, x′ far (Δ = 2.0)', a: 0.4, b: 2.4 },
  orth: { label: 'x, x′ orthogonal (Δ = π)', a: 0, b: Math.PI },
}

export default {
  id: 'qsvm',
  track: 'algorithm',
  group: 'linalg',
  dir: { problem: 'Data classification, kernel methods', advantage: 'Exponential (for kernel evaluation)', mechanism: 'Quantum state inner products' },
  name: 'Quantum SVM',
  level: 'Intermediate',
  category: 'Machine learning',
  speedup: 'Kernel-dependent',
  summary: 'Map data into quantum states and let the quantum computer measure their similarity (a kernel); a classical SVM then draws the boundary.',
  analogy:
    'Two dancers each perform a routine dictated by their data point. The swap test watches them together: identical routines always "pass", unrelated ones pass half the time. That pass rate is the similarity a support-vector machine needs.',
  keyIdea:
    'An SVM only ever needs similarities K(x, x′) between points. A quantum feature map |φ(x)⟩ can live in a space too large to simulate; its kernel |⟨φ(x)|φ(x′)⟩|² is still estimated by a short circuit — the swap test gives P(0) = ½ + ½·K.',
  limits:
    'An advantage needs a feature map that is hard to simulate classically and actually suits the data — this 2-qubit demo is easy to simulate. Kernel estimates also need many shots.',
  lab: 'qsvm',
  flow: [
    { lane: 'Classical computer', title: 'Training points (x, label)', text: '', kind: 'classical' },
    { lane: 'Quantum computer', title: 'Encode |φ(x)⟩, |φ(x′)⟩', text: 'Feature-map circuit per point.', kind: 'quantum', via: 'classical', loop: 'every pair' },
    { lane: 'Quantum computer', title: 'Swap test / overlap circuit', text: 'Estimate K(x, x′) from shots.', kind: 'measure', loop: 'every pair' },
    { lane: 'Classical computer', title: 'Train SVM on the kernel matrix', text: 'Find support vectors and weights.', kind: 'classical', via: 'classical' },
    { lane: 'Classical computer', title: 'Classify new x', text: 'Needs K(x, support vectors) — more circuits.', kind: 'classical' },
  ],
  params: [{ key: 'pair', label: 'Data pair (angle encoding)', options: Object.entries(PAIRS).map(([value, p]) => ({ value, label: p.label })), default: 'close' }],
  build({ pair }) {
    const { a, b } = PAIRS[pair]
    const overlap = Math.cos((a - b) / 2) ** 2
    const p0 = 0.5 + 0.5 * overlap
    return {
      qubits: 3,
      labels: ['anc', 'φ(x)', 'φ(x′)'],
      readout: [0],
      steps: [
        { title: 'Encode both points', gates: [ry(a, 1), ry(b, 2)], narration: `Each data value becomes a rotation angle: |φ(x)⟩ = Ry(${a.toFixed(2)})|0⟩, |φ(x′)⟩ = Ry(${b.toFixed(2)})|0⟩.` },
        { title: 'Ancilla → |+⟩', gates: [gate('h', 0)], narration: 'The swap test’s referee qubit.' },
        { title: 'Controlled-SWAP', gates: cswap(0, 1, 2), narration: 'Swap the two states only on the |1⟩ branch of the ancilla (built from three Toffolis).' },
        {
          title: 'Ancilla H, measure',
          gates: [gate('h', 0)],
          narration: `The branches interfere. P(anc = 0) = ½ + ½·|⟨φ(x)|φ(x′)⟩|² = ${p0.toFixed(3)}, so the kernel is K = ${overlap.toFixed(3)}.`,
          math: 'P(0) = (1 + K)/2',
        },
      ],
      answer: { text: `P(anc = 0) = ${p0.toFixed(3)} → K = ${overlap.toFixed(3)}.`, check: (dist) => Math.abs((dist['0'] ?? 0) - p0) < 1e-9 },
    }
  },
}
