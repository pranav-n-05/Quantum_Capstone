import { eigSym, gaussian, range, rng } from '../numeric'
import { expectPauli } from '../pauli'
import { applyOps, zeroState } from '../statevector'

// --- Quantum kernel (QSVM) ---------------------------------------------------------

/**
 * A two-qubit ZZ feature map, repeated twice: H on both, phase x₀ and x₁,
 * then an entangling phase (π − x₀)(π − x₁). The entangling term is what makes
 * the kernel something other than a product of two cosines.
 */
export function featureOps([x0, x1], reps = 2) {
  const layer = [
    { g: 'h', t: [0] },
    { g: 'h', t: [1] },
    { g: 'p', t: [0], angle: 2 * x0 },
    { g: 'p', t: [1], angle: 2 * x1 },
    { g: 'cx', c: [0], t: [1] },
    { g: 'p', t: [1], angle: 2 * (Math.PI - x0) * (Math.PI - x1) },
    { g: 'cx', c: [0], t: [1] },
  ]
  return range(reps).flatMap(() => layer)
}

export const featureState = (x) => applyOps(zeroState(2), featureOps(x))

/** K(a, b) = |⟨φ(a)|φ(b)⟩|². */
export function quantumKernel(a, b) {
  const sa = a.re ? a : featureState(a)
  const sb = b.re ? b : featureState(b)
  let re = 0
  let im = 0
  for (let i = 0; i < 4; i++) {
    re += sa.re[i] * sb.re[i] + sa.im[i] * sb.im[i]
    im += sa.re[i] * sb.im[i] - sa.im[i] * sb.re[i]
  }
  return re * re + im * im
}

export const rbfKernel = (a, b, gamma = 0.5) => Math.exp(-gamma * ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2))

/**
 * The labelling rule, as in Havlíček et al. (Nature 2019): a point's class is
 * the sign of a fixed observable O = V†(Z⊗Z)V measured on its feature state.
 * That makes the classes separable by a hyperplane *in the quantum feature
 * space* by construction -- the setting in which a quantum kernel can help.
 */
const LABEL_V = [
  { g: 'ry', t: [0], angle: 0.9 },
  { g: 'cx', c: [0], t: [1] },
  { g: 'ry', t: [1], angle: -1.3 },
]

export const labelScore = (x) => expectPauli(applyOps(featureState(x), LABEL_V), 'ZZ')

/** Points on [0, 2π]², labelled by labelScore, with a margin gap kept clear. */
export function makeDataset(seed = 7, count = 24, gap = 0.3) {
  const rand = rng(seed)
  const pts = []
  let guard = 0
  while (pts.length < count && guard++ < 20000) {
    const x = [rand() * 2 * Math.PI, rand() * 2 * Math.PI]
    const s = labelScore(x)
    if (Math.abs(s) < gap) continue
    const y = s > 0 ? 1 : -1
    if (pts.filter((p) => p.y === y).length >= count / 2) continue
    pts.push({ x, y })
  }
  return pts
}

/**
 * Simplified SMO (Platt) for a precomputed kernel matrix. Deterministic for a
 * given seed. Returns dual coefficients α and bias b.
 */
export function trainSvm(K, y, { C = 5, tol = 1e-4, maxPasses = 20, seed = 3 } = {}) {
  const n = y.length
  const alpha = new Array(n).fill(0)
  let b = 0
  const rand = rng(seed)
  const f = (i) => alpha.reduce((s, a, j) => s + a * y[j] * K[j][i], 0) + b
  let passes = 0
  let guard = 0
  while (passes < maxPasses && guard++ < 2000) {
    let changed = 0
    for (let i = 0; i < n; i++) {
      const Ei = f(i) - y[i]
      if ((y[i] * Ei < -tol && alpha[i] < C) || (y[i] * Ei > tol && alpha[i] > 0)) {
        let j = Math.floor(rand() * (n - 1))
        if (j >= i) j++
        const Ej = f(j) - y[j]
        const ai = alpha[i]
        const aj = alpha[j]
        const L = y[i] === y[j] ? Math.max(0, ai + aj - C) : Math.max(0, aj - ai)
        const H = y[i] === y[j] ? Math.min(C, ai + aj) : Math.min(C, C + aj - ai)
        if (L === H) continue
        const eta = 2 * K[i][j] - K[i][i] - K[j][j]
        if (eta >= 0) continue
        let ajNew = aj - (y[j] * (Ei - Ej)) / eta
        ajNew = Math.min(H, Math.max(L, ajNew))
        if (Math.abs(ajNew - aj) < 1e-6) continue
        const aiNew = ai + y[i] * y[j] * (aj - ajNew)
        const b1 = b - Ei - y[i] * (aiNew - ai) * K[i][i] - y[j] * (ajNew - aj) * K[i][j]
        const b2 = b - Ej - y[i] * (aiNew - ai) * K[i][j] - y[j] * (ajNew - aj) * K[j][j]
        alpha[i] = aiNew
        alpha[j] = ajNew
        b = aiNew > 0 && aiNew < C ? b1 : ajNew > 0 && ajNew < C ? b2 : (b1 + b2) / 2
        changed++
      }
    }
    passes = changed === 0 ? passes + 1 : 0
  }
  return { alpha, b }
}

export const svmDecision = (model, y, kernelRow) => model.alpha.reduce((s, a, j) => s + a * y[j] * kernelRow[j], 0) + model.b

// --- QPCA ---------------------------------------------------------------------------

export const QPCA_EIGENVALUES = [0.75, 0.25]

/** ρ = R(α)·diag(¾, ¼)·R(α)ᵀ: a covariance matrix with trace 1. */
export function qpcaRho(alpha) {
  const c = Math.cos(alpha)
  const s = Math.sin(alpha)
  const [l1, l2] = QPCA_EIGENVALUES
  return [
    [l1 * c * c + l2 * s * s, (l1 - l2) * c * s],
    [(l1 - l2) * c * s, l1 * s * s + l2 * c * c],
  ]
}

/** Samples whose covariance is (proportional to) ρ. */
export function qpcaData(alpha, count = 160, seed = 11) {
  const rand = rng(seed)
  const { values, vectors } = eigSym(qpcaRho(alpha))
  return range(count).map(() => {
    const a = gaussian(rand) * Math.sqrt(values[0])
    const b = gaussian(rand) * Math.sqrt(values[1])
    return [a * vectors[0][0] + b * vectors[1][0], a * vectors[0][1] + b * vectors[1][1]]
  })
}
