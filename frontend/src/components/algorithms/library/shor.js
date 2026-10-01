import { modPow, order } from '../../../quantum/numeric'
import { gate, inverseQft, mulModMap, onEach, range, toBits } from './shared'

const N = 15
const COUNT = range(3) // c0..c2
const WORK = [3, 4, 5, 6] // w0..w3 hold a number mod 15
const BASES = [2, 4, 7, 8, 11, 13, 14]

export default {
  id: 'shor',
  track: 'algorithm',
  group: 'fourier',
  dir: { problem: 'Integer Factorization & Discrete Logarithm', advantage: 'Exponential', mechanism: 'Quantum Phase Estimation, QFT' },
  name: "Shor's Algorithm",
  level: 'Advanced',
  category: 'Factoring',
  speedup: 'Exponential',
  summary: 'Factor N by finding the period of aˣ mod N — a quantum period-finder plus a page of classical number theory.',
  analogy:
    'A lighthouse whose beam repeats every r seconds. Classically you stand on the shore and count; quantumly you photograph every second at once and a Fourier lens shows the rhythm directly. Knowing the rhythm r splits N with a gcd.',
  keyIdea:
    'If aʳ ≡ 1 (mod N) with r even, then (a^{r/2} − 1)(a^{r/2} + 1) is a multiple of N, so gcd(a^{r/2} ± 1, N) usually gives a factor. Finding r is hard classically; quantumly it is phase estimation on "multiply by a mod N", whose eigenphases are s/r.',
  limits:
    'Factoring 15 needs 7 qubits here; RSA-2048 would need millions of error-corrected qubits. The modular multiplications are drawn as single boxes (exact reversible permutations), not compiled to elementary gates.',
  lab: 'shor',
  flow: [
    { lane: 'Classical computer', title: 'Pick a random a < N', text: 'If gcd(a, N) > 1 you already found a factor.', kind: 'classical' },
    { lane: 'Quantum computer', title: 'Work register = 1, counters → |+⟩', text: 'Superpose every exponent x at once.', kind: 'quantum', via: 'classical' },
    { lane: 'Quantum computer', title: 'Controlled ×a^(2ᵏ) mod N', text: 'Builds Σₓ |x⟩|aˣ mod N⟩ — every power at once.', kind: 'quantum', loop: 'k = 0 … t−1' },
    { lane: 'Quantum computer', title: 'Inverse QFT, measure', text: 'Outcome m ≈ 2ᵗ·s/r for a random s.', kind: 'measure' },
    { lane: 'Classical computer', title: 'Continued fractions', text: 'm/2ᵗ → s/r gives a candidate period r.', kind: 'classical', via: 'classical' },
    { lane: 'Classical computer', title: 'r even and a^{r/2} ≢ −1?', text: 'If not, pick another a and repeat.', kind: 'decision' },
    { lane: 'Classical computer', title: 'gcd(a^{r/2} ± 1, N)', text: 'The factors.', kind: 'classical' },
  ],
  params: [
    {
      key: 'a',
      label: 'Base a (N = 15)',
      options: BASES.map((a) => ({ value: String(a), label: `a = ${a}  (period ${order(a, N)})` })),
      default: '7',
    },
  ],
  build({ a: aStr }) {
    const a = Number(aStr)
    const r = order(a, N)
    const peaks = range(r).map((s) => toBits((8 * s) / r, 3))
    const powers = COUNT.map((k) => modPow(a, 2 ** k, N))
    return {
      qubits: 7,
      labels: ['c0', 'c1', 'c2', 'w0', 'w1', 'w2', 'w3'],
      readout: COUNT,
      steps: [
        {
          title: 'Work register = 1',
          gates: [gate('x', WORK[0])],
          narration: 'The four work qubits hold a number mod 15. Start it at 1, since a⁰ = 1.',
        },
        {
          title: 'Every exponent at once',
          gates: onEach('h', COUNT),
          narration: 'Three counting qubits in superposition represent every exponent x = 0 … 7 simultaneously.',
        },
        ...COUNT.map((k) => ({
          title: `Controlled ×${powers[k]} mod 15 (c${k})`,
          gates: [{ g: 'perm', t: WORK, c: [k], map: mulModMap(powers[k], N, 4), label: `×${powers[k]}` }],
          narration:
            powers[k] === 1
              ? `a^${2 ** k} ≡ 1 (mod 15), so this multiplication does nothing — a hint that the period divides ${2 ** k}.`
              : `If c${k} is 1, multiply the work register by a^${2 ** k} mod 15 = ${powers[k]}. Together these three steps compute aˣ mod 15 for every x in superposition.`,
          math: `|x⟩|1⟩ → |x⟩|${a}ˣ mod 15⟩`,
        })),
        {
          title: 'Inverse QFT on the counters',
          gates: inverseQft(COUNT),
          narration: `aˣ mod 15 repeats every r = ${r} steps. The inverse QFT turns that rhythm into sharp peaks at multiples of 8/r: ${peaks.join(', ')}. The classical half of the algorithm (see the Lab tab) reads r off any of them.`,
          math: 'm ≈ 2³ · s / r',
        },
      ],
      answer: { bits: peaks, text: `Peaks only at ${peaks.join(', ')} (multiples of 8/${r}), each ${(100 / r).toFixed(0)}%.` },
    }
  },
}
