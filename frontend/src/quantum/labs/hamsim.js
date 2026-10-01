import { eigSym, range } from '../numeric'
import { applyOps, probabilities, zeroState } from '../statevector'

/**
 * Two-spin transverse-field Ising model H = J·Z₀Z₁ + h·(X₀ + X₁). Small
 * enough to solve exactly, rich enough that its two terms do not commute --
 * which is the whole reason Trotterisation has an error to study.
 */
export function isingMatrix(J, h) {
  const M = Array.from({ length: 4 }, () => new Array(4).fill(0))
  for (let i = 0; i < 4; i++) {
    const b0 = i & 1
    const b1 = (i >> 1) & 1
    M[i][i] = J * (b0 === b1 ? 1 : -1)
    M[i ^ 1][i] += h // X₀
    M[i ^ 2][i] += h // X₁
  }
  return M
}

/** e^{−iHt}|00⟩, exactly, by diagonalisation. */
export function exactState(J, h, t) {
  const { values, vectors } = eigSym(isingMatrix(J, h))
  const re = new Float64Array(4)
  const im = new Float64Array(4)
  values.forEach((lam, k) => {
    const overlap = vectors[k][0] // ⟨v_k|00⟩, real
    for (let i = 0; i < 4; i++) {
      re[i] += vectors[k][i] * overlap * Math.cos(-lam * t)
      im[i] += vectors[k][i] * overlap * Math.sin(-lam * t)
    }
  })
  return { n: 2, re, im }
}

const zz = (J, dt) => [
  { g: 'cx', c: [0], t: [1] },
  { g: 'rz', t: [1], angle: 2 * J * dt },
  { g: 'cx', c: [0], t: [1] },
]
const xx = (h, dt) => [
  { g: 'rx', t: [0], angle: 2 * h * dt },
  { g: 'rx', t: [1], angle: 2 * h * dt },
]

/** One Trotter step of length dt: first order A·B, second order A/2·B·A/2. */
export function trotterStep(J, h, dt, order = 1) {
  return order === 2 ? [...xx(h, dt / 2), ...zz(J, dt), ...xx(h, dt / 2)] : [...zz(J, dt), ...xx(h, dt)]
}

export function trotterState(J, h, t, steps, order = 1) {
  const dt = t / steps
  return applyOps(zeroState(2), range(steps).flatMap(() => trotterStep(J, h, dt, order)))
}

/** ⟨Z₀⟩ of a 2-qubit state. */
export function zExpect(state, q = 0) {
  const p = probabilities(state)
  return range(4).reduce((s, i) => s + p[i] * ((i >> q) & 1 ? -1 : 1), 0)
}

/** 1 − |⟨exact|trotter⟩|². */
export function infidelity(a, b) {
  let re = 0
  let im = 0
  for (let i = 0; i < a.re.length; i++) {
    re += a.re[i] * b.re[i] + a.im[i] * b.im[i]
    im += a.re[i] * b.im[i] - a.im[i] * b.re[i]
  }
  return Math.max(0, 1 - (re * re + im * im))
}
