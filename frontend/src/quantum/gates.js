import { add, c, expi, mul, scale } from './complex'

/**
 * 2×2 gate matrices as `[[a, b], [c, d]]` of complex numbers.
 *
 * Every multi-qubit gate in this project is a controlled single-qubit gate
 * (or a SWAP), so these matrices are the whole gate set.
 */

const S2 = Math.SQRT1_2

export const MATRICES = {
  i: [[c(1), c(0)], [c(0), c(1)]],
  x: [[c(0), c(1)], [c(1), c(0)]],
  y: [[c(0), c(0, -1)], [c(0, 1), c(0)]],
  z: [[c(1), c(0)], [c(0), c(-1)]],
  h: [[c(S2), c(S2)], [c(S2), c(-S2)]],
  s: [[c(1), c(0)], [c(0), c(0, 1)]],
  sdg: [[c(1), c(0)], [c(0), c(0, -1)]],
  t: [[c(1), c(0)], [c(0), expi(Math.PI / 4)]],
  tdg: [[c(1), c(0)], [c(0), expi(-Math.PI / 4)]],
}

export const rx = (t) => [
  [c(Math.cos(t / 2)), c(0, -Math.sin(t / 2))],
  [c(0, -Math.sin(t / 2)), c(Math.cos(t / 2))],
]

export const ry = (t) => [
  [c(Math.cos(t / 2)), c(-Math.sin(t / 2))],
  [c(Math.sin(t / 2)), c(Math.cos(t / 2))],
]

export const rz = (t) => [
  [expi(-t / 2), c(0)],
  [c(0), expi(t / 2)],
]

/** Phase gate P(λ) = diag(1, e^{iλ}). Controlled-P is the QFT's building block. */
export const phase = (l) => [
  [c(1), c(0)],
  [c(0), expi(l)],
]

/** Qiskit's U(θ, φ, λ). */
export const u = (theta, phi, lambda) => {
  const cos = Math.cos(theta / 2)
  const sin = Math.sin(theta / 2)
  return [
    [c(cos), scale(expi(lambda), -sin)],
    [scale(expi(phi), sin), scale(expi(phi + lambda), cos)],
  ]
}

/** Rotation by γ about the unit Bloch axis n: cos(γ/2)·I − i·sin(γ/2)·(n·σ). */
export const axisRotation = ([nx, ny, nz], gamma) => {
  const cos = Math.cos(gamma / 2)
  const sin = Math.sin(gamma / 2)
  return [
    [c(cos, -nz * sin), c(-ny * sin, -nx * sin)],
    [c(ny * sin, -nx * sin), c(cos, nz * sin)],
  ]
}

/** Resolve an op's gate name (+ angle) to its matrix. */
export function matrixFor(op) {
  switch (op.g) {
    case 'rx':
      return rx(op.angle)
    case 'ry':
      return ry(op.angle)
    case 'rz':
      return rz(op.angle)
    case 'p':
      return phase(op.angle)
    case 'u':
      return u(...op.params)
    case 'cx':
      return MATRICES.x
    case 'cz':
      return MATRICES.z
    case 'cp':
      return phase(op.angle)
    default: {
      const m = MATRICES[op.g]
      if (!m) throw new Error(`Unknown gate "${op.g}"`)
      return m
    }
  }
}

export const matmul2 = (A, B) =>
  [0, 1].map((r) => [0, 1].map((k) => add(mul(A[r][0], B[0][k]), mul(A[r][1], B[1][k]))))
