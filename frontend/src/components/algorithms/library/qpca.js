import { eigSym, expiSym } from '../../../quantum/numeric'
import { qpcaRho } from '../../../quantum/labs/ml'
import { cx, inverseQft, mat, onEach, ry } from './shared'

const SYS = 0
const REF = 1
const CLOCK = [2, 3]
const ANGLES = { 0: '0°', 30: '30°', 60: '60°', 120: '120°' }

export default {
  id: 'qpca',
  track: 'algorithm',
  group: 'linalg',
  dir: { problem: 'Density matrix decomposition', advantage: 'Exponential', mechanism: 'Density matrix exponentiation' },
  name: 'QPCA',
  level: 'Advanced',
  category: 'Machine learning',
  speedup: 'Exponential*',
  summary: 'Principal component analysis on a quantum computer: treat the data’s covariance as a density matrix ρ and phase-estimate e^{2πiρ} to read off its principal components.',
  analogy:
    'Shine light through a crystal that splits it into its pure colours. ρ is the light; phase estimation is the prism; each colour that comes out is a principal direction, and its brightness is the variance along it.',
  keyIdea:
    'A normalised covariance matrix is a valid density matrix. Running phase estimation with U = e^{2πiρ} on ρ itself returns eigenvalue λₖ with probability λₖ and leaves the eigenvector behind — sampling the principal components in proportion to their weight.',
  limits:
    '*Lloyd–Mohseni–Rebentrost build e^{−iρt} from many copies of ρ ("density-matrix exponentiation"); here it is applied directly as a 2×2 gate. Classical "dequantised" algorithms (Tang 2019) erase much of the advantage for low-rank data.',
  lab: 'qpca',
  flow: [
    { lane: 'Classical computer', title: 'Data → covariance → ρ', text: 'Normalise so trace = 1.', kind: 'classical' },
    { lane: 'Quantum computer', title: 'Prepare copies of ρ', text: 'Here: a purification on system + reference.', kind: 'quantum', via: 'classical' },
    { lane: 'Quantum computer', title: 'Phase estimation of e^{2πiρ}', text: 'Built from copies via partial swaps.', kind: 'quantum' },
    { lane: 'Quantum computer', title: 'Measure the clock', text: 'λₖ with probability λₖ; system ≈ |uₖ⟩.', kind: 'measure' },
    { lane: 'Classical computer', title: 'Repeat → spectrum', text: 'Large λ = principal component.', kind: 'classical', via: 'classical' },
  ],
  params: [{ key: 'angle', label: 'Data tilt (principal axis)', options: Object.entries(ANGLES).map(([value, label]) => ({ value, label })), default: '30' }],
  build({ angle }) {
    const alpha = (Number(angle) * Math.PI) / 180
    const rho = qpcaRho(alpha)
    const { values } = eigSym(rho)
    const big = values[1]
    return {
      qubits: 4,
      labels: ['sys', 'ref', 'c0', 'c1'],
      readout: CLOCK,
      steps: [
        {
          title: 'Purify ρ',
          gates: [ry(Math.PI / 3, SYS), cx(SYS, REF), ry(2 * alpha, SYS), ry(2 * alpha, REF)],
          narration: `√¾|u₁⟩|u₁⟩ + √¼|u₂⟩|u₂⟩: tracing out "ref" leaves exactly the data’s ρ on "sys". The principal axis u₁ is tilted ${ANGLES[angle]}.`,
        },
        { title: 'Clock → |+⟩', gates: onEach('h', CLOCK), narration: 'Two clock qubits — enough to read eigenvalues ¼ and ¾ exactly.' },
        {
          title: 'Controlled e^{2πiρ}, e^{4πiρ}',
          gates: [mat(expiSym(rho, 2 * Math.PI), SYS, { c: [CLOCK[0]], label: 'e^{iρ}' }), mat(expiSym(rho, 4 * Math.PI), SYS, { c: [CLOCK[1]], label: 'e²' })],
          narration: 'Each eigenvector of ρ picks up phase λ; the clock records it.',
        },
        {
          title: 'Inverse QFT, measure',
          gates: inverseQft(CLOCK),
          narration: `Clock reads 3 (λ = ¾, the principal component) ${(big * 100).toFixed(0)}% of the time and 1 (λ = ¼) otherwise. Each run also leaves "sys" in that component’s direction.`,
          math: 'P(λₖ) = λₖ',
        },
      ],
      answer: { text: 'Clock 11 (λ = ¾) 75%, 01 (λ = ¼) 25%.', check: (d) => Math.abs((d['11'] ?? 0) - 0.75) < 1e-9 && Math.abs((d['01'] ?? 0) - 0.25) < 1e-9 },
    }
  },
}
