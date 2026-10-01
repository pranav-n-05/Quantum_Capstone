import { expiSym } from '../../../quantum/numeric'
import { gate, forwardQft, inverseQft, mat, onEach } from './shared'

const B = 0
const CLOCK = [1, 2]
const ANC = 3
const A = [
  [1.5, 0.5],
  [0.5, 1.5],
] // eigenvalues 1 and 2
const T = Math.PI / 2 // e^{iAt} has eigenphases λ/4: exactly 1/4 and 2/4

const U = (k, sign = 1) => expiSym(A, sign * T * 2 ** k)

const INPUTS = {
  zero: { label: '|b⟩ = |0⟩', prep: [], x: [0.75, -0.25] },
  one: { label: '|b⟩ = |1⟩', prep: [gate('x', B)], x: [-0.25, 0.75] },
  plus: { label: '|b⟩ = |+⟩', prep: [gate('h', B)], x: [0.5 * Math.SQRT1_2, 0.5 * Math.SQRT1_2] },
}

export default {
  id: 'hhl',
  track: 'algorithm',
  group: 'linalg',
  dir: { problem: 'Solving systems of linear equations', advantage: 'Exponential (under strict conditions)', mechanism: 'QPE, conditional rotation' },
  name: 'HHL Algorithm',
  level: 'Advanced',
  category: 'Linear algebra',
  speedup: 'Exponential*',
  summary: 'Prepare a quantum state proportional to x = A⁻¹b — solving A·x = b — in time polylogarithmic in the matrix size.',
  analogy:
    'Dividing by a matrix means dividing each "direction" by its own stretch factor. HHL first sorts the input by direction (phase estimation), divides each part by its stretch (a rotation on a helper qubit), then un-sorts.',
  keyIdea:
    'Write b in A’s eigenbasis: b = Σ βⱼ|uⱼ⟩. Phase estimation tags each part with its eigenvalue λⱼ; a rotation sets a helper qubit’s |1⟩ amplitude to C/λⱼ; uncomputing the tags and keeping only runs where the helper reads 1 leaves Σ (βⱼ/λⱼ)|uⱼ⟩ = A⁻¹b.',
  limits:
    '*The famous fine print: A must be sparse and well-conditioned, b must be loadable fast, and you get the answer as a quantum state — reading every entry out would erase the speedup. Useful when you only need a property of x, like an expectation value.',
  lab: 'hhl',
  flow: [
    { lane: 'Quantum computer', title: 'Load |b⟩', text: 'b as a quantum state (amplitude encoding).', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Phase estimation of e^{iAt}', text: 'Clock register learns each eigenvalue λⱼ.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Controlled rotation', text: 'Helper qubit: amplitude C/λⱼ on |1⟩.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Uncompute the clock', text: 'Inverse phase estimation.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Helper reads 1?', text: 'If 0, discard and repeat (post-selection).', kind: 'decision', loop: 'until success' },
    { lane: 'Quantum computer', title: '|x⟩ ∝ A⁻¹|b⟩', text: 'Use it — e.g. estimate ⟨x|M|x⟩.', kind: 'quantum' },
  ],
  params: [
    {
      key: 'b',
      label: 'Right-hand side (A = [[1.5, 0.5], [0.5, 1.5]])',
      options: Object.entries(INPUTS).map(([value, v]) => ({ value, label: v.label })),
      default: 'zero',
    },
  ],
  build({ b }) {
    const input = INPUTS[b]
    const [x0, x1] = input.x
    const norm = x0 * x0 + x1 * x1
    const p0 = (x0 * x0) / norm
    return {
      qubits: 4,
      labels: ['b', 'c0', 'c1', 'anc'],
      readout: [B, ANC],
      steps: [
        ...(input.prep.length ? [{ title: 'Load b', gates: input.prep, narration: `Encode the right-hand side as the state ${input.label.split('= ')[1]}.` }] : []),
        {
          title: 'Phase estimation: clock → |+⟩',
          gates: onEach('h', CLOCK),
          narration: 'A 2-qubit clock will learn A’s eigenvalues. Here A has eigenvalues 1 (direction |−⟩) and 2 (direction |+⟩).',
        },
        {
          title: 'Controlled e^{iAt} and e^{2iAt}',
          gates: [mat(U(0), B, { c: [CLOCK[0]], label: 'U' }), mat(U(1), B, { c: [CLOCK[1]], label: 'U²' })],
          narration: 'With t = π/2, eigenvalue λ becomes phase λ/4 — exactly 1/4 or 2/4, so a 2-bit clock reads it perfectly.',
          math: 'U = e^{iAt},  U|uⱼ⟩ = e^{2πi·λⱼ/4}|uⱼ⟩',
        },
        {
          title: 'Inverse QFT: clock = λ',
          gates: inverseQft(CLOCK),
          narration: 'The clock now holds 1 (01) for the |−⟩ part of b and 2 (10) for the |+⟩ part. Each piece of b is tagged with its own eigenvalue.',
        },
        {
          title: 'Divide by λ (controlled rotation)',
          gates: [
            { g: 'ry', t: [ANC], angle: Math.PI, c: [CLOCK[0]], nc: [CLOCK[1]], label: 'R(1)' },
            { g: 'ry', t: [ANC], angle: Math.PI / 3, c: [CLOCK[1]], nc: [CLOCK[0]], label: 'R(½)' },
          ],
          narration: 'The helper qubit is rotated so its |1⟩ amplitude is 1/λ: fully for λ = 1, halfway (sin = ½) for λ = 2. This is where the "division" happens.',
          math: 'anc: |0⟩ → √(1 − 1/λ²)|0⟩ + (1/λ)|1⟩',
        },
        {
          title: 'Uncompute the clock',
          gates: [...forwardQft(CLOCK), mat(U(1, -1), B, { c: [CLOCK[1]], label: 'U⁻²' }), mat(U(0, -1), B, { c: [CLOCK[0]], label: 'U⁻¹' }), ...onEach('h', CLOCK)],
          narration: 'Run phase estimation backwards so the clock returns to |00⟩ and stops being entangled with b.',
        },
        {
          title: 'Keep runs where anc = 1',
          gates: [],
          narration: `Look at the readout: among outcomes with anc = 1, P(b=0) : P(b=1) = ${(p0 * 100).toFixed(0)}% : ${((1 - p0) * 100).toFixed(0)}% — exactly the classical answer x = A⁻¹b ∝ (${x0.toFixed(3)}, ${x1.toFixed(3)}).`,
          math: 'x ∝ Σ (βⱼ/λⱼ)|uⱼ⟩',
        },
      ],
      answer: {
        text: `Given anc = 1, b reads 0 with ${(p0 * 100).toFixed(1)}% — matching A⁻¹b.`,
        check: (dist) => {
          const s0 = dist['10'] ?? 0 // anc=1, b=0 (key = anc b)
          const s1 = dist['11'] ?? 0
          return Math.abs(s0 / (s0 + s1) - p0) < 1e-9
        },
        postselected: p0,
      },
    }
  },
}
