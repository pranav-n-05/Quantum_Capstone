import { gate, ry } from './shared'

const Q = 0
const ANGLES = {
  30: { label: 'p = 25%   (θ = 30°)', theta: Math.PI / 6, rounds: 1 },
  18: { label: 'p ≈ 9.5%  (θ = 18°)', theta: Math.PI / 10, rounds: 2 },
  12.86: { label: 'p ≈ 4.9%  (θ ≈ 12.9°)', theta: Math.PI / 14, rounds: 3 },
}

export default {
  id: 'amplitude-amplification',
  track: 'algorithm',
  group: 'search',
  dir: { problem: "Generalizing Grover's for any search space", advantage: 'Polynomial (Quadratic)', mechanism: 'Reflection operators' },
  name: 'Amplitude Amplification',
  level: 'Intermediate',
  category: 'Search',
  speedup: 'Quadratic',
  summary: 'Boost any procedure that succeeds with probability p to near-certainty in ~1/√p repetitions instead of ~1/p.',
  analogy:
    'A torch you can only nudge: every round, two mirrors turn its beam by the same small angle toward the target. Grover is the special case where the torch starts evenly spread; here it can start anywhere.',
  keyIdea:
    'Let A prepare the state with success amplitude sin θ. The good and bad parts span a 2-D plane. Reflecting about "bad", then about A|0⟩, rotates the state by 2θ in that plane. After k rounds the success probability is sin²((2k+1)θ).',
  limits: 'Needs a way to recognise success (an oracle) and to run A and A⁻¹. Shown on one qubit so the rotation is visible on a single Bloch sphere.',
  lab: 'amplitude-amplification',
  flow: [
    { lane: 'Quantum computer', title: 'Run A', text: 'Succeeds with amplitude sin θ (probability p = sin²θ).', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'S_χ: flip the good part', text: 'Reflection about the bad axis.', kind: 'quantum', loop: '≈ π/(4θ) rounds' },
    { lane: 'Quantum computer', title: 'A·S₀·A⁻¹: reflect about the start', text: 'Two reflections = rotation by 2θ toward good.', kind: 'quantum', loop: '≈ π/(4θ) rounds' },
    { lane: 'Quantum computer', title: 'Measure', text: 'Success with probability sin²((2k+1)θ).', kind: 'measure' },
  ],
  params: [
    {
      key: 'angle',
      label: 'Starting success chance',
      options: Object.entries(ANGLES).map(([value, a]) => ({ value, label: a.label })),
      default: '18',
    },
  ],
  build({ angle }) {
    const { theta, rounds } = ANGLES[angle]
    const A = ry(2 * theta, Q)
    const Ainv = ry(-2 * theta, Q)
    const steps = [
      {
        title: 'Run A once',
        gates: [A],
        narration: `A rotates |0⟩ by 2θ = ${((2 * theta * 180) / Math.PI).toFixed(1)}° toward |1⟩ ("good"). Success chance ${(Math.sin(theta) ** 2 * 100).toFixed(1)}% — the arrow on the sphere is barely tilted.`,
      },
    ]
    for (let k = 1; k <= rounds; k++) {
      const p = Math.sin((2 * k + 1) * theta) ** 2
      steps.push(
        { title: `Round ${k} · flip the good part`, gates: [gate('z', Q)], narration: 'S_χ = Z flips the sign of |1⟩: a reflection of the arrow through the bad (x–z) plane.' },
        {
          title: `Round ${k} · reflect about A|0⟩`,
          gates: [Ainv, gate('x', Q), gate('z', Q), gate('x', Q), A, { g: 'gphase', t: [], angle: Math.PI }],
          narration: `A·S₀·A⁻¹ reflects about the starting direction. The two reflections together rotate the arrow by 2θ. Success is now ${(p * 100).toFixed(1)}%.`,
          math: `P(good) = sin²((2·${k}+1)θ) = ${p.toFixed(3)}`,
        },
      )
    }
    return {
      qubits: 1,
      labels: ['q'],
      readout: [Q],
      steps,
      answer: { bits: ['1'], text: `After ${rounds} round${rounds > 1 ? 's' : ''}: P(good) = 100%.` },
    }
  },
}
