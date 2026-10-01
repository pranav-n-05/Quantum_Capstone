import { diffusionOps, markState, onEach, range, toBits } from './shared'

const IDX = range(4) // i = (q0, q1), j = (q2, q3)
const LISTS = {
  a: { label: '[3, 1, 3, 0]', values: [3, 1, 3, 0] },
  b: { label: '[2, 0, 1, 2]', values: [2, 0, 1, 2] },
  c: { label: '[0, 1, 2, 1]', values: [0, 1, 2, 1] },
}

const collisions = (values) =>
  range(16).filter((v) => {
    const i = v & 3
    const j = v >> 2
    return i !== j && values[i] === values[j]
  })

export default {
  id: 'element-distinctness',
  track: 'algorithm',
  group: 'walks',
  dir: { problem: 'Finding if elements in a list are distinct', advantage: 'Polynomial', mechanism: 'Quantum walks on Johnson graphs' },
  name: 'Element Distinctness',
  level: 'Advanced',
  category: 'Walks',
  speedup: 'N → N²ᐟ³',
  summary: 'Decide whether a list of N items contains a repeat using O(N^{2/3}) lookups (Ambainis 2004) instead of N.',
  analogy:
    'Looking for two guests with the same birthday. Ambainis keeps a small group of guests "in the room", swaps one at a time, and lets the quantum walk over all possible groups home in on a group that contains a matching pair.',
  keyIdea:
    'Vertices of the Johnson graph J(N, r) are r-subsets of the list; neighbours differ by one element. A subset is "marked" if it contains a collision. A quantum walk finds a marked subset in ~√(1/ε)·√r steps, and balancing setup cost r against walk cost gives N^{2/3}.',
  limits:
    'The circuit is a simpler cousin: Grover search over all index pairs (i, j), which is O(N) — enough to show the "mark the collision and amplify" idea on 4 qubits. The full Johnson-graph walk is shown as a diagram in the Lab.',
  lab: 'element-distinctness',
  flow: [
    { lane: 'Quantum computer', title: 'Superpose subsets of size r', text: 'Read their r values into memory (setup: r queries).', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Check: subset has a repeat?', text: 'Free — values are already stored.', kind: 'decision', loop: '√(N/r) rounds' },
    { lane: 'Quantum computer', title: 'Walk: swap one element', text: '√r update steps, 1 query each.', kind: 'quantum', loop: '√(N/r) rounds' },
    { lane: 'Quantum computer', title: 'Measure a marked subset', text: 'It contains the colliding pair.', kind: 'measure' },
    { lane: 'Classical computer', title: 'Report the pair', text: 'Total ≈ r + √(N/r)·√r = N^{2/3} for r = N^{2/3}.', kind: 'classical', via: 'classical' },
  ],
  params: [{ key: 'list', label: 'List x₀…x₃', options: Object.entries(LISTS).map(([value, l]) => ({ value, label: l.label })), default: 'a' }],
  build({ list }) {
    const { values } = LISTS[list]
    const marked = collisions(values)
    const oracle = marked.flatMap((v) => markState(toBits(v, 4), IDX))
    const pairs = marked.map((v) => `(${v & 3}, ${v >> 2})`)
    return {
      qubits: 4,
      labels: ['i0', 'i1', 'j0', 'j1'],
      readout: IDX,
      steps: [
        { title: 'Every pair (i, j)', gates: onEach('h', IDX), narration: 'Two 2-bit indices: all 16 ordered pairs at once.' },
        ...[1, 2].flatMap((r) => [
          {
            title: `Round ${r} · mark collisions`,
            gates: oracle,
            narration: `The oracle compares x_i with x_j and flips the sign when they match and i ≠ j: pairs ${pairs.join(' and ')}.`,
          },
          { title: `Round ${r} · amplify`, gates: diffusionOps(IDX), narration: 'Diffusion grows the marked pairs.' },
        ]),
      ],
      answer: {
        text: `Reads a colliding pair ${pairs.join(' or ')} with ≈ 95% probability.`,
        check: (dist) => marked.reduce((s, v) => s + (dist[toBits(v, 4)] ?? 0), 0) > 0.9,
      },
    }
  },
}
