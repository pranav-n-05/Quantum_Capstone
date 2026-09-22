import { matrixFor } from './gates'

/**
 * A dense statevector simulator for the algorithm debugger.
 *
 * Qubit 0 is the least-significant bit of a basis index -- the same
 * convention as Qiskit, so a bitstring reads `q(n-1) … q1 q0` and matches the
 * Playground's histograms. States are `{ n, re: Float64Array, im: Float64Array }`
 * and every operation returns a new state; the debugger keeps one per step.
 *
 * An op is `{ g, t: [targets], c?: [controls], angle?, params? }`:
 *   { g: 'h', t: [0] }                  single-qubit gate
 *   { g: 'cx', c: [0], t: [1] }          controlled gate (any number of controls)
 *   { g: 'cp', c: [0], t: [2], angle }   controlled phase
 *   { g: 'swap', t: [0, 2] }             swap
 *   { g: 'gphase', t: [], angle }        global phase e^{i·angle} (unobservable;
 *                                        used only to keep displayed signs textbook)
 */

export function zeroState(n) {
  const re = new Float64Array(1 << n)
  const im = new Float64Array(1 << n)
  re[0] = 1
  return { n, re, im }
}

const copy = (state) => ({ n: state.n, re: state.re.slice(), im: state.im.slice() })

/** Apply a 2×2 matrix to `target`, only on basis states where every control is 1. */
export function applyMatrix(state, M, target, controls = []) {
  const next = copy(state)
  const { re, im } = next
  const bit = 1 << target
  const mask = controls.reduce((m, q) => m | (1 << q), 0)
  const [[a, b], [cc, d]] = M

  for (let i = 0; i < re.length; i++) {
    if (i & bit) continue // visit each (|…0…⟩, |…1…⟩) pair once, from its 0 side
    if ((i & mask) !== mask) continue
    const j = i | bit
    const r0 = re[i], i0 = im[i], r1 = re[j], i1 = im[j]
    re[i] = a.re * r0 - a.im * i0 + b.re * r1 - b.im * i1
    im[i] = a.re * i0 + a.im * r0 + b.re * i1 + b.im * r1
    re[j] = cc.re * r0 - cc.im * i0 + d.re * r1 - d.im * i1
    im[j] = cc.re * i0 + cc.im * r0 + d.re * i1 + d.im * r1
  }
  return next
}

export function swap(state, a, b) {
  const next = copy(state)
  const ba = 1 << a
  const bb = 1 << b
  for (let i = 0; i < next.re.length; i++) {
    if ((i & ba) && !(i & bb)) {
      const j = (i & ~ba) | bb
      ;[next.re[i], next.re[j]] = [next.re[j], next.re[i]]
      ;[next.im[i], next.im[j]] = [next.im[j], next.im[i]]
    }
  }
  return next
}

function globalPhase(state, angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const next = copy(state)
  for (let i = 0; i < next.re.length; i++) {
    next.re[i] = state.re[i] * cos - state.im[i] * sin
    next.im[i] = state.re[i] * sin + state.im[i] * cos
  }
  return next
}

export function applyOp(state, op) {
  if (op.g === 'swap') return swap(state, op.t[0], op.t[1])
  if (op.g === 'gphase') return globalPhase(state, op.angle)
  return applyMatrix(state, matrixFor(op), op.t[0], op.c ?? [])
}

export const applyOps = (state, ops) => ops.reduce(applyOp, state)

export function probabilities(state) {
  const out = new Float64Array(state.re.length)
  for (let i = 0; i < out.length; i++) out[i] = state.re[i] ** 2 + state.im[i] ** 2
  return out
}

/** Basis index → bitstring, most-significant qubit first. */
export const bitstring = (index, n) => index.toString(2).padStart(n, '0')

/**
 * The Bloch vector of one qubit after tracing out the rest.
 *
 * For a product state this is a unit vector. When the qubit is entangled its
 * reduced state is mixed and the vector shrinks toward the centre -- the
 * debugger uses exactly that shrinkage to make entanglement visible.
 */
export function blochVector(state, q) {
  const bit = 1 << q
  let p0 = 0
  let p1 = 0
  let offRe = 0 // Re ρ01
  let offIm = 0 // Im ρ01
  for (let i = 0; i < state.re.length; i++) {
    if (i & bit) continue
    const j = i | bit
    const ar = state.re[i], ai = state.im[i], br = state.re[j], bi = state.im[j]
    p0 += ar * ar + ai * ai
    p1 += br * br + bi * bi
    // ρ01 = Σ a_i · conj(a_j)
    offRe += ar * br + ai * bi
    offIm += ai * br - ar * bi
  }
  // ρ = (I + xX + yY + zZ)/2  ⇒  ρ01 = (x − iy)/2
  return { x: 2 * offRe, y: -2 * offIm, z: p0 - p1 }
}

export const vectorLength = ({ x, y, z }) => Math.sqrt(x * x + y * y + z * z)
