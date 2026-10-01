import { binomial, linearFit, range, rng } from '../numeric'

// --- State tomography -------------------------------------------------------------

/**
 * Measure N copies in each of X, Y, Z. Each axis gives ⟨σ⟩ = 2·k/N − 1,
 * which is that Bloch component. Too few shots can land outside the sphere;
 * the physical estimate is pulled back to its surface.
 */
export function tomography(r, shots, rand) {
  const counts = ['x', 'y', 'z'].map((axis) => binomial(rand, shots, (1 + r[axis]) / 2))
  const raw = { x: (2 * counts[0]) / shots - 1, y: (2 * counts[1]) / shots - 1, z: (2 * counts[2]) / shots - 1 }
  const len = Math.hypot(raw.x, raw.y, raw.z)
  const physical = len > 1 ? { x: raw.x / len, y: raw.y / len, z: raw.z / len } : raw
  const error = Math.hypot(raw.x - r.x, raw.y - r.y, raw.z - r.z)
  return { counts, raw, physical, error, fidelity: (1 + r.x * physical.x + r.y * physical.y + r.z * physical.z) / 2 }
}

/**
 * Mean distance between the estimated and true Bloch vectors. Each component
 * is an average of N coin flips, so the error shrinks as 1/√N: 100× the shots
 * buys 10× the accuracy.
 */
export function tomographyCurve(r, shotList, trials = 40, seed = 5) {
  const rand = rng(seed)
  return shotList.map((shots) => {
    let err = 0
    for (let k = 0; k < trials; k++) err += tomography(r, shots, rand).error
    return { shots, error: err / trials }
  })
}

// --- Randomized benchmarking -------------------------------------------------------

/**
 * Single-qubit Cliffords act on the Bloch sphere as the 24 rotations of a
 * cube: 3×3 signed permutation matrices. Generated from H and S.
 */
const H3 = [
  [0, 0, 1],
  [0, -1, 0],
  [1, 0, 0],
]
const S3 = [
  [0, -1, 0],
  [1, 0, 0],
  [0, 0, 1],
]
const mul3 = (A, B) => A.map((row) => [0, 1, 2].map((j) => row.reduce((s, a, k) => s + a * B[k][j], 0)))
const key3 = (M) => M.flat().join(',')

export const CLIFFORDS = (() => {
  const I = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]
  const seen = new Map([[key3(I), I]])
  const queue = [I]
  while (queue.length) {
    const M = queue.shift()
    for (const g of [H3, S3]) {
      const P = mul3(g, M)
      if (!seen.has(key3(P))) {
        seen.set(key3(P), P)
        queue.push(P)
      }
    }
  }
  return [...seen.values()]
})()

const apply3 = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2])
const transpose = (M) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => M[j][i]))

const rotZ = (eps) => [
  [Math.cos(eps), -Math.sin(eps), 0],
  [Math.sin(eps), Math.cos(eps), 0],
  [0, 0, 1],
]

/**
 * Survival probability of one random sequence of m Cliffords plus the one
 * that undoes them, under depolarising error p per gate and an optional
 * coherent over-rotation ε about z after each gate.
 */
function sequenceSurvival(m, { p, eps }, rand) {
  let v = [0, 0, 1]
  let total = CLIFFORDS[0]
  const noisy = (M) => {
    v = apply3(M, v)
    if (eps) v = apply3(rotZ(eps), v)
    v = v.map((x) => x * (1 - p))
  }
  for (let k = 0; k < m; k++) {
    const C = CLIFFORDS[Math.floor(rand() * CLIFFORDS.length)]
    total = mul3(C, total)
    noisy(C)
  }
  noisy(transpose(total)) // recovery: the inverse of everything so far
  return (1 + v[2]) / 2
}

export function randomizedBenchmarking({ p = 0.02, eps = 0, lengths = [1, 2, 4, 8, 16, 32, 64, 100], sequences = 30, shots = 0, seed = 9 } = {}) {
  const rand = rng(seed)
  const points = lengths.map((m) => {
    const values = range(sequences).map(() => {
      const s = sequenceSurvival(m, { p, eps }, rand)
      return shots ? binomial(rand, shots, s) / shots : s
    })
    return { m, survival: values.reduce((a, b) => a + b, 0) / values.length, values }
  })
  const usable = points.filter((pt) => pt.survival - 0.5 > 1e-4)
  const { slope, intercept } = linearFit(
    usable.map((pt) => pt.m),
    usable.map((pt) => Math.log(pt.survival - 0.5)),
  )
  const f = Math.exp(slope)
  return { points, f, A: Math.exp(intercept), errorPerClifford: (1 - f) / 2 }
}

// --- Entanglement-enhanced clock comparison ---------------------------------------

/**
 * N qubits in a GHZ state each pick up phase φ from a clock offset; the
 * parity fringe oscillates as cos(Nφ), N times faster than one qubit's.
 */
export const ghzFringe = (N, phi) => Math.cos((N * phi) / 2) ** 2

/** Phase uncertainty after M repetitions: standard quantum limit vs Heisenberg limit. */
export const sqlPrecision = (N, M) => 1 / Math.sqrt(N * M)
export const heisenbergPrecision = (N, M) => 1 / (N * Math.sqrt(M))
