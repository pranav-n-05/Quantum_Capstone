import { bestAngles, cutValue, expectedCut, GRAPHS, maxCut, qaoaOps } from '../../../quantum/labs/variational'
import { probabilities } from '../../../quantum/statevector'
import { range } from './shared'

const BEST = Object.fromEntries(Object.entries(GRAPHS).map(([k, g]) => [k, bestAngles(g)]))

export default {
  id: 'qaoa',
  track: 'algorithm',
  group: 'variational',
  dir: { problem: 'Combinatorial optimization (e.g., MaxCut)', advantage: 'Heuristic / Near-term', mechanism: 'Alternating operator ansatz' },
  name: 'QAOA',
  level: 'Intermediate',
  category: 'Variational',
  speedup: 'Heuristic',
  summary: 'Approximate hard optimisation problems — here MaxCut — by alternating "cost" and "mixing" pulses whose two angles a classical optimiser tunes.',
  analogy:
    'Shaking a tray of marbles over a bumpy floor: the cost pulse tilts the floor toward good answers, the mixer shakes everything so it can move. Get the tilt-and-shake timing right and the marbles collect in the deepest dips.',
  keyIdea:
    'Encode the problem in a cost Hamiltonian C (count of cut edges). e^{−iγC} gives every candidate a phase proportional to its score; e^{−iβΣX} lets those phases interfere. For good (γ, β) the interference favours high-scoring cuts.',
  limits: 'Depth p = 1 on 4 nodes, where brute force is instant. Whether QAOA beats classical heuristics at scale is an open question.',
  lab: 'qaoa',
  flow: [
    { lane: 'Classical computer', title: 'Encode the graph', text: 'C = Σ over edges (1 − ZᵢZⱼ)/2.', kind: 'classical' },
    { lane: 'Quantum computer', title: '|+⟩ on every node', text: 'Every cut equally likely.', kind: 'quantum', via: 'classical' },
    { lane: 'Quantum computer', title: 'Cost pulse e^{−iγC}', text: 'One Rzz per edge.', kind: 'quantum', loop: 'p layers' },
    { lane: 'Quantum computer', title: 'Mixer e^{−iβΣX}', text: 'Rx(2β) on every node.', kind: 'quantum', loop: 'p layers' },
    { lane: 'Quantum computer', title: 'Measure', text: 'Sample cuts; average their size.', kind: 'measure' },
    { lane: 'Classical computer', title: 'Tune (γ, β)', text: 'Maximise the average cut, repeat.', kind: 'classical', via: 'classical' },
  ],
  params: [
    {
      key: 'graph',
      label: 'Graph',
      options: Object.entries(GRAPHS).map(([value, g]) => ({ value, label: `${g.label} (max cut ${maxCut(g)})` })),
      default: 'ring',
    },
  ],
  build({ graph }) {
    const g = GRAPHS[graph]
    const { gamma, beta, value } = BEST[graph]
    const { prep, cost, mixer } = qaoaOps(g, gamma, beta)
    const best = maxCut(g)
    const winners = range(1 << g.n).filter((z) => cutValue(z, g.edges) === best)
    return {
      qubits: g.n,
      labels: range(g.n).map((q) => `v${q}`),
      readout: range(g.n),
      steps: [
        { title: 'Every cut at once', gates: prep, narration: `Each of the ${2 ** g.n} ways to split the ${g.n} nodes is equally likely. The average cut is ${(g.edges.length / 2).toFixed(1)} edges.` },
        {
          title: `Cost pulse (γ = ${gamma.toFixed(3)})`,
          gates: cost,
          narration: 'Each edge adds a phase depending on whether its two ends differ. Heights do not change — only colours, which now encode each cut’s score.',
          math: 'e^{−iγC},  C = Σ (1 − ZᵢZⱼ)/2',
        },
        {
          title: `Mixer (β = ${beta.toFixed(3)})`,
          gates: mixer,
          narration: `X rotations let neighbouring cuts interfere. With the optimised angles the best cuts grow: average cut ${value.toFixed(2)} of a possible ${best}.`,
          math: 'e^{−iβΣX}',
        },
      ],
      answer: {
        text: `Average cut ${value.toFixed(2)} / ${best}; the best cuts are the most likely outcomes.`,
        check: (dist, final) => {
          const p = probabilities(final)
          const top = [...p.keys()].sort((a, b) => p[b] - p[a])[0]
          return winners.includes(top) && Math.abs(expectedCut(g, gamma, beta) - value) < 1e-9
        },
      },
    }
  },
}
