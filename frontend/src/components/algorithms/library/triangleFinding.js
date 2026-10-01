import { diffusionOps, markState, onEach, range, toBits } from './shared'

// Triples of {0,1,2,3}, indexed by the vertex they leave out.
const TRIPLES = range(4).map((skip) => range(4).filter((v) => v !== skip))

const GRAPHS = {
  a: { label: 'Triangle 0–1–2 + edge 2–3', edges: [[0, 1], [1, 2], [0, 2], [2, 3]] },
  b: { label: 'Triangle 1–2–3 + edge 0–1', edges: [[1, 2], [2, 3], [1, 3], [0, 1]] },
  c: { label: 'Triangle 0–2–3 + edge 0–1', edges: [[0, 2], [2, 3], [0, 3], [0, 1]] },
}

const hasEdge = (edges, a, b) => edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
const isTriangle = (edges, [a, b, c]) => hasEdge(edges, a, b) && hasEdge(edges, b, c) && hasEdge(edges, a, c)

export default {
  id: 'triangle-finding',
  track: 'algorithm',
  group: 'walks',
  dir: { problem: 'Finding a triangle in a dense graph', advantage: 'Polynomial', mechanism: 'Quantum walks' },
  name: 'Triangle Finding',
  level: 'Advanced',
  category: 'Walks',
  speedup: 'n³ → n⁵ᐟ⁴',
  summary: 'Find three mutually connected vertices in an n-vertex graph with far fewer edge queries than checking all ~n³ triples.',
  analogy:
    'Finding three friends who all know each other in a big school. Grover over triples already helps (n^{1.5}); nesting quantum walks — first over vertex sets, then over edges — pushes it to n^{5/4}.',
  keyIdea:
    'Grover search over the C(n,3) triples, with an oracle that checks three edges, needs ~n^{1.5} queries. Walk-based algorithms reuse queried edges between steps (Magniez–Santha–Szegedy: n^{1.3}; Le Gall 2014: n^{5/4}).',
  limits: 'The circuit is the Grover version on a 4-vertex graph: 4 triples, one triangle, so one round finds it with certainty. The nested walks are explained in the Lab.',
  lab: 'triangle-finding',
  flow: [
    { lane: 'Quantum computer', title: 'Superpose all triples', text: 'C(n, 3) candidates.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Oracle: 3 edges present?', text: 'Three edge queries per check.', kind: 'decision', loop: '≈ √(n³) rounds' },
    { lane: 'Quantum computer', title: 'Diffusion', text: 'Amplify the triangle.', kind: 'quantum', loop: '≈ √(n³) rounds' },
    { lane: 'Quantum computer', title: 'Measure', text: 'A triangle.', kind: 'measure' },
  ],
  params: [{ key: 'graph', label: 'Graph', options: Object.entries(GRAPHS).map(([value, g]) => ({ value, label: g.label })), default: 'a' }],
  build({ graph }) {
    const { edges } = GRAPHS[graph]
    const idx = TRIPLES.findIndex((t) => isTriangle(edges, t))
    return {
      qubits: 2,
      labels: ['t0', 't1'],
      readout: [0, 1],
      steps: [
        { title: 'All four triples', gates: onEach('h', [0, 1]), narration: `Index t names the triple that leaves out vertex t: ${TRIPLES.map((t, i) => `${i}→{${t.join(',')}}`).join(', ')}.` },
        {
          title: 'Oracle: is it a triangle?',
          gates: markState(toBits(idx, 2), [0, 1]),
          narration: `Only {${TRIPLES[idx].join(', ')}} has all three edges. Its sign flips.`,
        },
        { title: 'Diffusion', gates: diffusionOps([0, 1]), narration: 'With 1 marked item out of 4, one Grover round is exact: the triangle has probability 100%.' },
      ],
      answer: { bits: [toBits(idx, 2)], text: `Reads ${toBits(idx, 2)} → triangle {${TRIPLES[idx].join(', ')}}.` },
    }
  },
}

export { TRIPLES, GRAPHS as TRIANGLE_GRAPHS, isTriangle }
