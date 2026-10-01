import { modPow } from '../../../quantum/numeric'
import { gate, inverseQft, onEach, range, toBits } from './shared'

const P = 5
const G = 2 // generator of Z₅*, order 4
const A_REG = [0, 1]
const B_REG = [2, 3]
const WORK = [4, 5, 6]

const mulMod5 = (m) => range(8).map((v) => (v >= 1 && v < P ? (m * v) % P : v))

export default {
  id: 'shor-dlog',
  track: 'algorithm',
  group: 'fourier',
  dir: { problem: 'Finding discrete logs over finite fields', advantage: 'Exponential', mechanism: 'QFT, QPE' },
  name: "Shor's Discrete Log",
  level: 'Advanced',
  category: 'Number theory',
  speedup: 'Exponential',
  summary: 'Given g and h = gˣ mod p, find the exponent x — the problem behind Diffie–Hellman and elliptic-curve cryptography.',
  analogy:
    'A clock with 4 positions. You know where "1 tick" lands and where the hand stopped; you want how many ticks. The algorithm builds a 2-D wallpaper g^a·h^b and reads the slope of its stripes — the slope is x.',
  keyIdea:
    'f(a, b) = gᵃ·hᵇ = g^{a + x·b} is constant along lines a + x·b = const. A 2-D Fourier transform of such stripes only lights up points (c, d) with d ≡ x·c (mod r), so any measured pair with c invertible gives x = d·c⁻¹.',
  limits: 'Toy group Z₅* (order 4) on 7 qubits. Real instances use 256-bit groups; the modular multiplications are drawn as boxes.',
  lab: 'shor-dlog',
  flow: [
    { lane: 'Quantum computer', title: 'Two exponent registers a, b → |+⟩', text: 'Every pair (a, b) at once; work register = 1.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Controlled ×g^(2ᵏ), ×h^(2ᵏ)', text: 'Work register becomes gᵃ·hᵇ mod p.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Inverse QFT on a and on b', text: 'Stripes become dots on the line d = x·c.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Measure (c, d)', text: 'Uniformly random point on that line.', kind: 'measure' },
    { lane: 'Classical computer', title: 'c invertible mod r?', text: 'If c = 0 or shares a factor with r, rerun.', kind: 'decision', via: 'classical' },
    { lane: 'Classical computer', title: 'x = d · c⁻¹ mod r', text: 'Check gˣ ≡ h.', kind: 'classical' },
  ],
  params: [
    {
      key: 'x',
      label: 'Secret exponent (g = 2, p = 5)',
      options: [1, 2, 3].map((x) => ({ value: String(x), label: `h = 2^? = ${modPow(G, x, P)}  (x = ${x})` })),
      default: '3',
    },
  ],
  build({ x: xStr }) {
    const x = Number(xStr)
    const h = modPow(G, x, P)
    const outcomes = range(4).map((c) => toBits((x * c) % 4, 2) + toBits(c, 2))
    return {
      qubits: 7,
      labels: ['a0', 'a1', 'b0', 'b1', 'w0', 'w1', 'w2'],
      readout: [...A_REG, ...B_REG],
      steps: [
        { title: 'Work register = 1', gates: [gate('x', WORK[0])], narration: 'The work register will hold an element of Z₅* = {1, 2, 3, 4}.' },
        {
          title: 'Every (a, b) at once',
          gates: onEach('h', [...A_REG, ...B_REG]),
          narration: 'Two 2-qubit exponent registers: all 16 pairs (a, b) in superposition.',
        },
        {
          title: `Controlled powers of g = ${G}`,
          gates: A_REG.map((q, k) => ({ g: 'perm', t: WORK, c: [q], map: mulMod5(modPow(G, 2 ** k, P)), label: `×${modPow(G, 2 ** k, P)}` })),
          narration: `Multiply by g^${'{2ᵏ}'} when aₖ = 1: the work register now holds 2ᵃ mod 5.`,
        },
        {
          title: `Controlled powers of h = ${h}`,
          gates: B_REG.map((q, k) => ({ g: 'perm', t: WORK, c: [q], map: mulMod5(modPow(h, 2 ** k, P)), label: `×${modPow(h, 2 ** k, P)}` })),
          narration: `Multiply by h^${'{2ᵏ}'} when bₖ = 1: the work register is 2ᵃ·${h}ᵇ = 2^{a + ${x}b} mod 5, constant along the stripes a + ${x}b = const.`,
          math: `f(a, b) = g^{a + x·b}`,
        },
        {
          title: 'Inverse QFT on both registers',
          gates: [...inverseQft(A_REG), ...inverseQft(B_REG)],
          narration: `Only pairs with d ≡ ${x}·c (mod 4) survive: ${outcomes.map((o) => `(c=${parseInt(o.slice(2), 2)}, d=${parseInt(o.slice(0, 2), 2)})`).join(', ')}. Any one with c odd reveals x = d·c⁻¹ mod 4.`,
          math: 'd ≡ x·c (mod 4)',
        },
      ],
      answer: { bits: outcomes, text: `Readout b₁b₀a₁a₀ lands only on d = ${x}·c mod 4 — four outcomes, 25% each.` },
    }
  },
}
