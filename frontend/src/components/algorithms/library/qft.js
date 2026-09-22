import { prepareBits, qftStages, range, toBits } from './shared'

const N = 3
const QUBITS = range(N)

export default {
  id: 'qft',
  name: 'Quantum Fourier Transform',
  level: 'Advanced',
  category: 'Transform',
  speedup: 'Exponential (n² vs n·2ⁿ gates)',
  summary: 'Re-express a number as a pattern of phases — the engine inside Shor’s algorithm and phase estimation.',
  analogy:
    'A row of clock hands. Input x sets how fast each hand spins: the first hand turns x/8 of a circle, the next twice as fast, the next four times. The answer is not in which bar is tallest — it is in the colours, which spin around the wheel at speed x.',
  params: [
    {
      key: 'input',
      label: 'Input number x',
      options: range(2 ** N).map((v) => ({ value: String(v), label: `${v}  (|${toBits(v, N)}⟩)` })),
      default: '3',
    },
  ],
  build({ input }) {
    const x = Number(input)
    const bits = toBits(x, N)
    const { stages, swaps } = qftStages(QUBITS)
    return {
      qubits: N,
      labels: ['q0', 'q1', 'q2'],
      readout: QUBITS,
      steps: [
        {
          title: `Load x = ${x}`,
          gates: prepareBits(bits),
          narration: `The register starts as the ordinary basis state |${bits}⟩ — one bar, all the probability on ${x}.`,
        },
        ...stages.map(({ qubit, ops }, i) => ({
          title: `Rotate q${qubit}`,
          gates: ops,
          narration:
            i === 0
              ? `A Hadamard spreads q${qubit} out, then controlled phase gates twist it by an amount set by the lower bits. The probability spreads out evenly — the information moves into the phases (bar colours).`
              : `Same pattern one level down: a Hadamard plus ${ops.length - 1 ? 'smaller twists from the lower qubits' : 'no further twists (it is the last qubit)'}. Each qubit ends up spinning at double the rate of the one below it.`,
          math: `q${qubit} → (|0⟩ + e^{2πi·0.${bits.slice(N - 1 - qubit)}}|1⟩)/√2  (binary fraction)`,
        })),
        {
          title: 'Undo the bit reversal',
          gates: swaps,
          narration:
            'The circuit naturally produces the result in reverse qubit order, so a SWAP puts it the right way round. Now read the colours left to right: they step around the phase wheel by x/8 of a turn each.',
          math: 'QFT|x⟩ = (1/√8) Σ_y e^{2πi·x·y/8} |y⟩',
        },
      ],
      answer: { text: `All 8 outcomes equally likely; phase of |y⟩ advances by ${x}·45° per step.` },
    }
  },
}
