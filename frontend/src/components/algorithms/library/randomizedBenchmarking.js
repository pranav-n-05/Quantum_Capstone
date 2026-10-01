import { rng } from '../../../quantum/numeric'
import { gate, range } from './shared'

const GATES = ['h', 's', 'sdg', 'x', 'y', 'z']
const DAGGER = { h: 'h', s: 'sdg', sdg: 's', x: 'x', y: 'y', z: 'z' }

export default {
  id: 'randomized-benchmarking',
  track: 'protocol',
  group: 'characterization',
  dir: { domain: 'Characterization', function: 'Estimating average error rates of quantum gates', resource: 'Random sequences of Clifford gates' },
  name: 'Randomized Benchmarking',
  level: 'Intermediate',
  category: 'Characterization',
  speedup: 'Immune to SPAM errors',
  summary: 'Run long random sequences of Clifford gates followed by the single gate that undoes them all. On perfect hardware you always get back |0⟩; the rate at which that fails with sequence length is the average gate error.',
  delivers: 'The "99.9% gate fidelity" numbers quoted for every quantum processor.',
  analogy:
    'Testing a Rubik’s-cube robot: give it a random scramble and then the exact unscramble. A perfect robot always ends solved. How quickly success drops as scrambles get longer tells you its error per move — independent of how well you can photograph the cube.',
  keyIdea:
    'Random Cliffords "twirl" any noise into simple depolarising noise, so survival decays as A·fᵐ + B. The fit gives f, and the average error per Clifford is r = (1 − f)/2 for a qubit. State-preparation and measurement errors only change A and B — not f.',
  limits: 'Gives an average over the Clifford group, not the error of a specific gate (interleaved RB does that). The simulation tracks the exact Bloch vector under the chosen noise.',
  lab: 'randomized-benchmarking',
  lanes: ['Classical computer', 'Quantum computer'],
  flow: [
    { lane: 'Classical computer', title: 'Draw m random Cliffords', text: '', kind: 'classical', loop: 'many m, many sequences' },
    { lane: 'Classical computer', title: 'Compute the recovery gate', text: 'The inverse of their product (cheap: Clifford).', kind: 'classical' },
    { lane: 'Quantum computer', title: 'Run sequence + recovery on |0⟩', text: '', kind: 'quantum', via: 'classical' },
    { lane: 'Quantum computer', title: 'Measure: survival = P(0)', text: '', kind: 'measure' },
    { lane: 'Classical computer', title: 'Fit A·fᵐ + B', text: 'Error per Clifford r = (1 − f)/2.', kind: 'classical', via: 'classical' },
  ],
  params: [{ key: 'm', label: 'Sequence length', options: [2, 4, 8].map((m) => ({ value: String(m), label: String(m) })), default: '4' }],
  build({ m }) {
    const rand = rng(Number(m) * 7 + 1)
    const seq = range(Number(m)).map(() => GATES[Math.floor(rand() * GATES.length)])
    return {
      qubits: 1,
      labels: ['q'],
      readout: [0],
      steps: [
        ...seq.map((g, k) => ({ title: `Random Clifford ${k + 1}`, gates: [gate(g, 0)], narration: `${g.toUpperCase()} — chosen at random. The arrow jumps between the six "cube face" directions.` })),
        {
          title: 'Recovery gate',
          gates: [...seq].reverse().map((g) => gate(DAGGER[g], 0)),
          narration: 'The inverse of the whole sequence (drawn as its pieces; on hardware it is compiled into one Clifford). Noise-free, the qubit is back at |0⟩ every time; the Lab adds noise and fits the decay.',
        },
      ],
      answer: { bits: ['0'], text: 'Noise-free: survival P(0) = 100%.' },
    }
  },
}
