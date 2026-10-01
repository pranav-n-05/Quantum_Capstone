import { hadamardWalk } from '../../../quantum/labs/walks'
import { gate, range } from './shared'

const POS = [0, 1, 2]
const COIN = 3
const inc = range(8).map((v) => (v + 1) % 8)
const dec = range(8).map((v) => (v + 7) % 8)

export default {
  id: 'quantum-walk',
  track: 'algorithm',
  group: 'walks',
  dir: { problem: 'Spatial search, graph traversal', advantage: 'Polynomial to Exponential', mechanism: 'Quantum superposition of random walks' },
  name: 'Quantum Walks',
  level: 'Intermediate',
  category: 'Walks',
  speedup: 'Polynomial → Exponential',
  summary: 'A walker that takes every path at once spreads linearly in time, not like √t — the engine behind many graph and search algorithms.',
  analogy:
    'A drunk walker drifts about √t steps from the lamppost. A quantum walker flips a quantum coin and goes both ways, and the paths interfere so it races outward — two bright fronts running away at constant speed.',
  keyIdea:
    'Replace the coin flip with a Hadamard on a coin qubit and the step with a coin-controlled shift. Amplitudes, not probabilities, add: paths to the centre cancel, paths to the edges reinforce, so the spread grows ∝ t.',
  limits: 'The exponential speedups (e.g. glued-trees traversal) need special graphs; on a line the gain is quadratic. The circuit uses an 8-site ring; the Lab simulates an unbounded line.',
  lab: 'quantum-walk',
  flow: [
    { lane: 'Quantum computer', title: 'Walker at 0, coin superposed', text: 'Position register + one coin qubit.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Toss the coin: H', text: 'Coin goes into superposition.', kind: 'quantum', loop: 't steps' },
    { lane: 'Quantum computer', title: 'Shift by the coin', text: 'Coin 1 → step right; coin 0 → step left.', kind: 'quantum', loop: 't steps' },
    { lane: 'Quantum computer', title: 'Measure position', text: 'Two peaks near ±t/√2, not one bell curve.', kind: 'measure' },
  ],
  params: [{ key: 'steps', label: 'Steps', options: [1, 2, 3].map((v) => ({ value: String(v), label: String(v) })), default: '3' }],
  build({ steps }) {
    const T = Number(steps)
    const expected = hadamardWalk(T)
    return {
      qubits: 4,
      labels: ['p0', 'p1', 'p2', 'coin'],
      readout: POS,
      steps: [
        {
          title: 'Coin (|0⟩ + i|1⟩)/√2',
          gates: [gate('h', COIN), gate('s', COIN)],
          narration: 'The walker sits at position 0. This particular coin state makes the walk symmetric; a plain |0⟩ coin would lean left.',
        },
        ...range(T).flatMap((k) => [
          { title: `Step ${k + 1} · toss`, gates: [gate('h', COIN)], narration: 'Hadamard on the coin: heads and tails at once.' },
          {
            title: `Step ${k + 1} · move`,
            gates: [
              { g: 'perm', t: POS, c: [COIN], map: inc, label: '+1' },
              { g: 'perm', t: POS, nc: [COIN], map: dec, label: '−1' },
            ],
            narration: 'Coin 1 moves right, coin 0 moves left (on an 8-site ring). Watch the position bars split and, after a few steps, lean outward instead of piling up in the middle.',
          },
        ]),
      ],
      answer: {
        text: `Matches the line walk: outer sites ±${T} outweigh the centre.`,
        check: (dist) =>
          expected.positions.every((x, i) => {
            const key = ((x + 8) % 8).toString(2).padStart(3, '0')
            return Math.abs((dist[key] ?? 0) - expected.probs[i]) < 1e-9
          }),
      },
    }
  },
}
