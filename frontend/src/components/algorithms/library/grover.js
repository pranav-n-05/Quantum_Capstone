import { bitOf, cz, gate, onEach, range, toBits } from './shared'

const N = 3
const QUBITS = range(N)

/** Flip the sign of exactly one basis state: map it to |111⟩, CCZ, map back. */
function markOps(bits) {
  const flips = QUBITS.filter((q) => !bitOf(bits, q)).map((q) => gate('x', q))
  return [...flips, cz([0, 1], 2), ...flips]
}

const diffusion = [
  ...onEach('h', QUBITS),
  ...onEach('x', QUBITS),
  cz([0, 1], 2),
  ...onEach('x', QUBITS),
  ...onEach('h', QUBITS),
  // H·X·CCZ·X·H is the diffusion operator times −1. A global phase changes
  // nothing measurable, but undoing it keeps the bar colours textbook: the
  // target reads as a positive amplitude, not everything flipped to negative.
  { g: 'gphase', t: [], angle: Math.PI },
]

export default {
  id: 'grover',
  track: 'algorithm',
  group: 'search',
  dir: { problem: 'Unstructured database search', advantage: 'Polynomial (quadratic)', mechanism: 'Amplitude amplification' },
  keyIdea:
    'Each round is two reflections, and two reflections make a rotation: the state turns a fixed angle toward the answer. After about (π/4)·√N rounds it points straight at it — keep going and it rotates past.',
  limits: 'Quadratic, not exponential: for N = 10¹² items it needs about 10⁶ rounds instead of 10¹², and the oracle must be built as a circuit.',
  flow: [
    { lane: 'Quantum computer', title: 'Superpose all N items', text: 'Hadamard on every qubit: each item gets amplitude 1/√N.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Oracle marks the answer', text: 'Flips the sign of the target’s amplitude — no probability changes yet.', kind: 'quantum', loop: '≈ (π/4)√N rounds' },
    { lane: 'Quantum computer', title: 'Diffusion', text: 'Reflect every amplitude about the average: the marked one grows.', kind: 'quantum', loop: '≈ (π/4)√N rounds' },
    { lane: 'Quantum computer', title: 'Measure', text: 'The answer comes out with high probability.', kind: 'measure' },
    { lane: 'Classical computer', title: 'Check it', text: 'One classical lookup confirms the result; rerun if wrong.', kind: 'classical', via: 'classical' },
  ],
  name: "Grover's Search",
  level: 'Intermediate',
  category: 'Search',
  speedup: 'Quadratic (√N)',
  summary: 'Find the one marked item among N unsorted ones in about √N steps.',
  analogy:
    'A room of 8 people humming the same note. The oracle quietly makes your target hum in the opposite phase; the diffusion step then turns up whoever is out of tune. Two rounds and your target is almost the only voice left.',
  queries: { classical: 7, quantum: 2, note: 'worst-case lookups among 8 items' },
  params: [
    {
      key: 'marked',
      label: 'Marked item',
      options: range(2 ** N).map((v) => ({ value: toBits(v, N), label: `${toBits(v, N)}  (#${v})` })),
      default: '110',
    },
    {
      key: 'iterations',
      label: 'Grover iterations',
      options: [1, 2, 3, 4].map((v) => ({ value: String(v), label: v === 2 ? '2 (optimal)' : String(v) })),
      default: '2',
    },
  ],
  build({ marked, iterations }) {
    const rounds = Number(iterations)
    const steps = [
      {
        title: 'Uniform superposition',
        gates: onEach('h', QUBITS),
        narration: 'All 8 items get the same amplitude, 1/√8. Measuring now would find the target 1 time in 8 — no better than guessing.',
      },
    ]
    for (let r = 1; r <= rounds; r++) {
      steps.push(
        {
          title: `Round ${r} · oracle`,
          gates: markOps(marked),
          narration: `The oracle recognises ${marked} and flips its sign — its bar changes colour, but its height (and so its probability) does not change yet.`,
          math: `|x⟩ → −|x⟩ if x = ${marked}`,
        },
        {
          title: `Round ${r} · diffusion`,
          gates: diffusion,
          narration:
            r <= 2
              ? 'Diffusion reflects every amplitude about the average. The flipped target sits far below the average, so it bounces far above it — its bar grows while the rest shrink. This is amplitude amplification.'
              : 'Another reflection — but the target is already past the peak, so this round overshoots and its probability falls. Grover is a rotation: stop at the right moment (≈ π/4·√N rounds).',
          math: 'a_x → 2·mean(a) − a_x',
        },
      )
    }
    return {
      qubits: N,
      labels: ['q0', 'q1', 'q2'],
      readout: QUBITS,
      steps,
      answer: { bits: [marked], text: `Reads ${marked} with high probability (≈94.5% after 2 rounds).` },
    }
  },
}
