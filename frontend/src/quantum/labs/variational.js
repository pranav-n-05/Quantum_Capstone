import { eigSym, range } from '../numeric'
import { expectHamiltonian, hamiltonianMatrix } from '../pauli'
import { applyOps, probabilities, zeroState } from '../statevector'

// --- VQE ------------------------------------------------------------------------

/**
 * The hydrogen molecule at 0.735 Å, reduced to two qubits (parity mapping with
 * two-qubit reduction) -- the standard teaching instance. Energies in Hartree,
 * electronic part only.
 */
export const H2_TERMS = [
  [-1.052373245772859, 'II'],
  [0.39793742484318045, 'IZ'],
  [-0.39793742484318045, 'ZI'],
  [-0.01128010425623538, 'ZZ'],
  [0.18093119978423156, 'XX'],
]

/**
 * One-parameter ansatz cos(θ/2)|01⟩ + sin(θ/2)|10⟩: a single "excitation"
 * rotating between the two configurations the XX term couples.
 */
export const vqeAnsatzOps = (theta) => [
  { g: 'ry', t: [1], angle: theta },
  { g: 'cx', c: [1], t: [0] },
  { g: 'x', t: [0] },
]

export const vqeEnergy = (theta, terms = H2_TERMS) => expectHamiltonian(applyOps(zeroState(2), vqeAnsatzOps(theta)), terms)

export function exactGroundEnergy(terms = H2_TERMS, n = 2) {
  return eigSym(hamiltonianMatrix(terms, n)).values[0]
}

/**
 * Gradient descent with the parameter-shift rule, the way a real VQE gets
 * gradients from hardware: two extra energy measurements at θ ± π/2, no
 * finite-difference guesswork.
 */
export function runVqe({ theta0 = 0.2, rate = 0.4, iterations = 30, terms = H2_TERMS } = {}) {
  const trace = []
  let theta = theta0
  for (let k = 0; k <= iterations; k++) {
    const energy = vqeEnergy(theta, terms)
    const grad = (vqeEnergy(theta + Math.PI / 2, terms) - vqeEnergy(theta - Math.PI / 2, terms)) / 2
    trace.push({ iteration: k, theta, energy, grad })
    theta -= rate * grad
  }
  return trace
}

export const CHEMICAL_ACCURACY = 0.0016 // Hartree (1 kcal/mol)

// --- QAOA -----------------------------------------------------------------------

export const GRAPHS = {
  ring: { label: 'Square (4-ring)', n: 4, edges: [[0, 1], [1, 2], [2, 3], [3, 0]] },
  kite: { label: 'Triangle + tail', n: 4, edges: [[0, 1], [1, 2], [2, 0], [2, 3]] },
  star: { label: 'Star', n: 4, edges: [[0, 1], [0, 2], [0, 3]] },
}

/** Number of edges cut by the bitstring index z (bit q = side of vertex q). */
export const cutValue = (z, edges) => edges.reduce((s, [i, j]) => s + (((z >> i) ^ (z >> j)) & 1), 0)

export const maxCut = (graph) => Math.max(...range(1 << graph.n).map((z) => cutValue(z, graph.edges)))

/**
 * p = 1 QAOA: |+⟩ⁿ, then e^{−iγC} (one Rzz per edge), then e^{−iβΣX}.
 * C = Σ (1 − ZᵢZⱼ)/2, so e^{−iγC} ∝ Π e^{+iγZZ/2} = Π Rzz(−γ).
 */
export function qaoaOps(graph, gamma, beta) {
  const cost = graph.edges.flatMap(([i, j]) => [
    { g: 'cx', c: [i], t: [j] },
    { g: 'rz', t: [j], angle: -gamma },
    { g: 'cx', c: [i], t: [j] },
  ])
  return {
    prep: range(graph.n).map((q) => ({ g: 'h', t: [q] })),
    cost,
    mixer: range(graph.n).map((q) => ({ g: 'rx', t: [q], angle: 2 * beta })),
  }
}

export function qaoaState(graph, gamma, beta) {
  const { prep, cost, mixer } = qaoaOps(graph, gamma, beta)
  return applyOps(zeroState(graph.n), [...prep, ...cost, ...mixer])
}

export function expectedCut(graph, gamma, beta) {
  const p = probabilities(qaoaState(graph, gamma, beta))
  let e = 0
  for (let z = 0; z < p.length; z++) e += p[z] * cutValue(z, graph.edges)
  return e
}

export const GAMMA_MAX = Math.PI
export const BETA_MAX = Math.PI / 2

/** ⟨C⟩ on a γ × β grid, rows = β (top = BETA_MAX), cols = γ. */
export function qaoaLandscape(graph, cols = 48, rows = 24) {
  return range(rows).map((r) =>
    range(cols).map((c) => expectedCut(graph, (GAMMA_MAX * c) / (cols - 1), BETA_MAX - (BETA_MAX * r) / (rows - 1))),
  )
}

/** Grid search, then a few rounds of local refinement. */
export function bestAngles(graph) {
  let best = { gamma: 0, beta: 0, value: -Infinity }
  for (let c = 0; c < 48; c++)
    for (let r = 0; r < 24; r++) {
      const gamma = (GAMMA_MAX * c) / 47
      const beta = (BETA_MAX * r) / 23
      const value = expectedCut(graph, gamma, beta)
      if (value > best.value) best = { gamma, beta, value }
    }
  let step = 0.05
  for (let k = 0; k < 60; k++) {
    let improved = false
    for (const [dg, db] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const value = expectedCut(graph, best.gamma + dg, best.beta + db)
      if (value > best.value + 1e-12) {
        best = { gamma: best.gamma + dg, beta: best.beta + db, value }
        improved = true
      }
    }
    if (!improved) step /= 2
  }
  return best
}
