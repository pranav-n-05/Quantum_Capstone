import { diffusionOps, inverseQft, markState, onEach, range, toBits } from './shared'

const COUNT = range(4) // c0..c3
const SEARCH = [4, 5, 6]
const N = 8
const SETS = {
  1: [5],
  2: [2, 5],
  4: [1, 2, 5, 6],
}

/** Grover iterate G = D·O, controlled by `c`. Only the core flips need the control. */
function controlledG(marked, c) {
  const oracle = marked.flatMap((v) => markState(toBits(v, 3), SEARCH).map((op) => (op.g === 'z' ? { ...op, c: [...(op.c ?? []), c] } : op)))
  const diff = diffusionOps(SEARCH).map((op) => (op.g === 'z' ? { ...op, c: [...op.c, c] } : op.g === 'gphase' ? { g: 'z', t: [c] } : op))
  return [...oracle, ...diff]
}

export const countingEstimate = (k) => N * Math.sin((Math.PI * k) / 16) ** 2

export default {
  id: 'quantum-counting',
  track: 'algorithm',
  group: 'search',
  dir: { problem: 'Estimating the number of solutions', advantage: 'Quadratic', mechanism: 'QPE applied to Grover iteration' },
  name: 'Quantum Counting',
  level: 'Advanced',
  category: 'Search',
  speedup: 'Quadratic',
  summary: 'Estimate how many of N items are marked — without finding them — by measuring how fast Grover’s rotation turns.',
  analogy:
    'Grover’s search turns a dial by an angle that depends only on how many winners there are. Instead of letting the dial turn, you time it with phase estimation: the rotation speed tells you the count.',
  keyIdea:
    'The Grover iterate G is a rotation by θ with sin²(θ/2) = M/N. Its eigenvalues are e^{±iθ}, so phase estimation on G returns θ, and M = N·sin²(θ/2). Error ~√M with ~√N calls to G, versus ~N classical samples.',
  limits: 'Four counting qubits give a coarse estimate (rounded here). The controlled-G blocks are drawn as boxes; each is ~15 gates.',
  lab: 'quantum-counting',
  flow: [
    { lane: 'Quantum computer', title: 'Search register → |+⟩', text: 'Uniform over all N items (sits in G’s rotation plane).', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Counting register → |+⟩', text: 't qubits of precision.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Controlled-G^(2ᵏ)', text: 'Phase estimation of the Grover rotation.', kind: 'quantum', loop: 'k = 0 … t−1' },
    { lane: 'Quantum computer', title: 'Inverse QFT, measure k', text: 'k/2ᵗ ≈ θ/2π (or 1 − θ/2π).', kind: 'measure' },
    { lane: 'Classical computer', title: 'M ≈ N·sin²(πk/2ᵗ)', text: 'Round to the nearest integer.', kind: 'classical', via: 'classical' },
  ],
  params: [
    {
      key: 'M',
      label: 'Marked items among N = 8',
      options: Object.keys(SETS).map((m) => ({ value: m, label: `M = ${m}  (items ${SETS[m].join(', ')})` })),
      default: '2',
    },
  ],
  build({ M }) {
    const marked = SETS[M]
    const m = Number(M)
    const steps = [
      { title: 'Search register → |+⟩', gates: onEach('h', SEARCH), narration: 'The search register starts uniform over 8 items — the input Grover would rotate.' },
      { title: 'Counting register → |+⟩', gates: onEach('h', COUNT), narration: 'Four counting qubits will record the rotation angle to 4 binary digits.' },
      ...COUNT.map((k) => ({
        title: `Controlled G^${2 ** k} (c${k})`,
        gates: range(2 ** k).flatMap(() => controlledG(marked, k)),
        display: [{ g: 'perm', t: SEARCH, c: [k], label: `G${['', '²', '⁴', '⁸'][k]}` }],
        narration: `Apply the Grover iterate ${2 ** k} time${k ? 's' : ''}, controlled by c${k}. Its rotation angle kicks back onto c${k} as a phase, exactly as in phase estimation.`,
      })),
      {
        title: 'Inverse QFT',
        gates: inverseQft(COUNT),
        narration: `The counter now reads k with k/16 ≈ θ/2π. The two peaks (k and 16 − k) are the eigenvalues e^{±iθ}; both give the same count: M ≈ 8·sin²(πk/16) ≈ ${m}.`,
        math: 'M = N·sin²(πk/2ᵗ)',
      },
    ]
    return {
      qubits: 7,
      labels: ['c0', 'c1', 'c2', 'c3', 's0', 's1', 's2'],
      readout: COUNT,
      steps,
      answer: {
        text: `Most likely k gives M ≈ ${m}.`,
        check: (dist) => {
          const best = Object.entries(dist).sort((a, b) => b[1] - a[1])[0][0]
          return Math.round(countingEstimate(parseInt(best, 2))) === m
        },
      },
    }
  },
}
