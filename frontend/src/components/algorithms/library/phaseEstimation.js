import { cp, gate, inverse, onEach, qftStages, range } from './shared'

const COUNT = range(3)
const TARGET = 3

const PHASES = [
  ['0.125', '1/8'],
  ['0.25', '1/4'],
  ['0.375', '3/8'],
  ['0.625', '5/8'],
  ['0.875', '7/8'],
  ['0.3', '0.3 (not a multiple of 1/8)'],
]

export default {
  id: 'qpe',
  name: 'Quantum Phase Estimation',
  level: 'Advanced',
  category: 'Transform',
  speedup: 'Exponential (precision per qubit)',
  summary: 'Measure the hidden phase θ of a gate U|ψ⟩ = e^{2πiθ}|ψ⟩ — the core of Shor’s factoring algorithm.',
  analogy:
    'Timing a spinning wheel with a strobe light. Flash it after 1, 2 and 4 turns and each flash lands at a different angle; the inverse QFT reads those angles like the digits of an odometer.',
  params: [
    {
      key: 'phase',
      label: 'Hidden phase θ',
      options: PHASES.map(([value, label]) => ({ value, label })),
      default: '0.375',
    },
  ],
  build({ phase }) {
    const theta = Number(phase)
    const { stages, swaps } = qftStages(COUNT)
    const qftOps = [...stages.flatMap((s) => s.ops), ...swaps]
    const expected = Math.round(theta * 8) % 8
    const exact = Math.abs(theta * 8 - Math.round(theta * 8)) < 1e-9

    return {
      qubits: 4,
      labels: ['c0', 'c1', 'c2', 'ψ'],
      readout: COUNT,
      steps: [
        {
          title: 'Prepare the eigenstate',
          gates: [gate('x', TARGET)],
          narration: `U here is a phase gate P(2π·${phase}); its eigenstate is |1⟩. The target qubit will not change at all from now on — only its phase will leak out.`,
        },
        {
          title: 'Counting qubits into superposition',
          gates: onEach('h', COUNT),
          narration: 'Three counting qubits, each ready to record one binary digit of θ.',
        },
        ...COUNT.map((k) => ({
          title: `Apply U^${2 ** k} controlled by c${k}`,
          gates: [cp(2 * Math.PI * theta * 2 ** k, k, TARGET)],
          narration: `Running U ${2 ** k} time${k ? 's' : ''} multiplies the phase ${2 ** k}×. Because the target is an eigenstate, the phase "kicks back" onto c${k}: its mini sphere spins around the equator by ${((360 * theta * 2 ** k) % 360).toFixed(0)}°.`,
          math: `c${k}: (|0⟩ + e^{2πi·${2 ** k}θ}|1⟩)/√2`,
        })),
        {
          title: 'Inverse QFT',
          gates: inverse(qftOps),
          narration: exact
            ? `The counting register now holds the QFT of 8θ = ${expected}. Undoing the QFT turns those phases back into an ordinary number: |${expected.toString(2).padStart(3, '0')}⟩, so θ = ${expected}/8.`
            : `8θ = ${(theta * 8).toFixed(1)} is not a whole number, so no 3-bit answer is exact. The probability piles up on the nearest values — ${expected}/8 is the best estimate. More counting qubits would sharpen it.`,
          math: 'θ ≈ (measured integer) / 2³',
        },
      ],
      answer: {
        bits: [expected.toString(2).padStart(3, '0')],
        exact,
        text: `Counting register reads ${expected.toString(2).padStart(3, '0')} → θ ≈ ${expected}/8${exact ? ' exactly' : ' (most likely)'}.`,
      },
    }
  },
}
