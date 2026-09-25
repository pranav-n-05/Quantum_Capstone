import { abs2, c, div, mul, sqrt, sub } from './complex'

/**
 * Single-qubit geometry for the Bloch Lab.
 *
 * The lab keeps its state as a Bloch vector `{x, y, z}` rather than as two
 * amplitudes: a vector can shrink below length 1 (decoherence), amplitudes
 * cannot, and the global phase amplitudes carry is unobservable anyway. Every
 * gate is therefore turned into what it physically is -- a rotation of the
 * sphere -- and the animation draws that same rotation.
 */

export const KET = {
  zero: { x: 0, y: 0, z: 1 },
  one: { x: 0, y: 0, z: -1 },
  plus: { x: 1, y: 0, z: 0 },
  minus: { x: -1, y: 0, z: 0 },
  plusI: { x: 0, y: 1, z: 0 },
  minusI: { x: 0, y: -1, z: 0 },
}

export const fromAngles = (theta, phi) => ({
  x: Math.sin(theta) * Math.cos(phi),
  y: Math.sin(theta) * Math.sin(phi),
  z: Math.cos(theta),
})

export const length = ({ x, y, z }) => Math.sqrt(x * x + y * y + z * z)

/** θ ∈ [0, π], φ ∈ (−π, π]. φ is meaningless at the poles and reported as 0. */
export function toAngles(v) {
  const r = length(v) || 1
  const theta = Math.acos(Math.max(-1, Math.min(1, v.z / r)))
  const phi = Math.hypot(v.x, v.y) < 1e-9 ? 0 : Math.atan2(v.y, v.x)
  return { theta, phi }
}

/** Canonical amplitudes α = cos(θ/2), β = e^{iφ} sin(θ/2) (α real, ≥ 0). */
export function toAmplitudes(v) {
  const { theta, phi } = toAngles(v)
  const s = Math.sin(theta / 2)
  return [c(Math.cos(theta / 2)), c(s * Math.cos(phi), s * Math.sin(phi))]
}

/** Bloch vector of a (normalised) amplitude pair. */
export function fromAmplitudes([a, b]) {
  // ρ01 = a·conj(b)
  const re = a.re * b.re + a.im * b.im
  const im = a.im * b.re - a.re * b.im
  return { x: 2 * re, y: -2 * im, z: abs2(a) - abs2(b) }
}

/**
 * The rotation a 2×2 unitary performs on the sphere: `{ axis, angle }` with
 * angle ∈ (−π, π], so animations always take the short way round.
 * The identity (up to global phase) returns angle 0.
 */
export function rotationOf(U) {
  const det = sub(mul(U[0][0], U[1][1]), mul(U[0][1], U[1][0]))
  const g = sqrt(det) // global phase e^{iα}
  const V = U.map((row) => row.map((x) => div(x, g)))

  const cosH = (V[0][0].re + V[1][1].re) / 2
  const nx = -(V[0][1].im + V[1][0].im) / 2
  const ny = (V[1][0].re - V[0][1].re) / 2
  const nz = (V[1][1].im - V[0][0].im) / 2
  const sinH = Math.sqrt(nx * nx + ny * ny + nz * nz)

  if (sinH < 1e-12) return { axis: [0, 0, 1], angle: 0 }
  let angle = 2 * Math.atan2(sinH, cosH)
  if (angle > Math.PI) angle -= 2 * Math.PI
  return { axis: [nx / sinH, ny / sinH, nz / sinH], angle }
}

/** Rodrigues' rotation of v about unit axis n by angle. */
export function rotate(v, [nx, ny, nz], angle) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dot = nx * v.x + ny * v.y + nz * v.z
  const cx = ny * v.z - nz * v.y
  const cy = nz * v.x - nx * v.z
  const cz = nx * v.y - ny * v.x
  return {
    x: v.x * cos + cx * sin + nx * dot * (1 - cos),
    y: v.y * cos + cy * sin + ny * dot * (1 - cos),
    z: v.z * cos + cz * sin + nz * dot * (1 - cos),
  }
}

/** Apply a unitary to a Bloch vector (works for mixed states too). */
export function applyUnitary(v, U) {
  const { axis, angle } = rotationOf(U)
  return rotate(v, axis, angle)
}

/**
 * Fidelity between the current state and a pure target, (1 + r·t)/2.
 * 1 means indistinguishable; 0.5 is what a coin flip would give you.
 */
export const fidelity = (v, t) => (1 + v.x * t.x + v.y * t.y + v.z * t.z) / 2

/** Purity Tr(ρ²) = (1 + |r|²)/2: 1 for pure, ½ for maximally mixed. */
export const purity = (v) => (1 + length(v) ** 2) / 2

/** ρ as `[[ρ00, ρ01], [ρ10, ρ11]]`. */
export function densityMatrix({ x, y, z }) {
  return [
    [c((1 + z) / 2), c(x / 2, -y / 2)],
    [c(x / 2, y / 2), c((1 - z) / 2)],
  ]
}

/**
 * Free evolution under T1 (energy relaxation toward |0⟩) and T2 (loss of
 * phase), for `t` in the same unit as T1/T2. Transverse components decay as
 * e^{-t/T2}; the z component relaxes toward +1 as e^{-t/T1}.
 */
export function relax(v, { t1, t2 }, t) {
  const transverse = Math.exp(-t / t2)
  const longitudinal = Math.exp(-t / t1)
  return { x: v.x * transverse, y: v.y * transverse, z: 1 + (v.z - 1) * longitudinal }
}

/** Probability of measuring 0. */
export const p0 = (v) => (1 + v.z) / 2

/**
 * A resonant microwave drive, in the frame rotating with the qubit.
 * H = ½(Δ σz + Ω(cos φ σx + sin φ σy)) with Ω, Δ in MHz, so the state
 * precesses about n̂ = (Ω cos φ, Ω sin φ, Δ)/Ω_eff at Ω_eff = √(Ω² + Δ²).
 * On resonance (Δ = 0) a pulse of length 1/(2Ω) is a π-pulse: a full flip.
 */
export function driveAxis({ rabi, detuning, phase }) {
  const eff = Math.hypot(rabi, detuning)
  if (eff < 1e-12) return { axis: [0, 0, 1], eff: 0 }
  return { axis: [(rabi * Math.cos(phase)) / eff, (rabi * Math.sin(phase)) / eff, detuning / eff], eff }
}

/** Rotation angle, in radians, a drive of `ns` nanoseconds produces. */
export const driveAngle = (drive, ns) => (2 * Math.PI * driveAxis(drive).eff * ns) / 1000

/** The drive as a 2×2 unitary exp(−i·angle·n̂·σ/2), for the gate pipeline. */
export function driveUnitary(drive, ns) {
  const { axis: [nx, ny, nz] } = driveAxis(drive)
  const half = driveAngle(drive, ns) / 2
  const cs = Math.cos(half)
  const sn = Math.sin(half)
  return [
    [c(cs, -sn * nz), c(-sn * ny, -sn * nx)],
    [c(sn * ny, -sn * nx), c(cs, sn * nz)],
  ]
}

/** State after driving `v` for `ns` nanoseconds (exact, any number of turns). */
export const drive = (v, d, ns) => rotate(v, driveAxis(d).axis, driveAngle(d, ns))
