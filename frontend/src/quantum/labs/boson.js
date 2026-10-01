import { cabs2, cx, haarUnitary, permanent, range, rng } from '../numeric'

/** All occupation patterns of k photons in m modes, as arrays of counts. */
export function patterns(k, m) {
  const out = []
  const rec = (mode, left, acc) => {
    if (mode === m - 1) {
      out.push([...acc, left])
      return
    }
    for (let c = left; c >= 0; c--) rec(mode + 1, left - c, [...acc, c])
  }
  rec(0, k, [])
  return out
}

const factorial = (n) => (n <= 1 ? 1 : n * factorial(n - 1))

/**
 * Output statistics for single photons entering `inputs` (distinct modes) of
 * interferometer U. Bosons: |Perm(U_S)|² / Π sᵢ!. Distinguishable particles:
 * Perm(|U_S|²) / Π sᵢ! -- the classical baseline boson sampling is compared
 * against.
 */
export function bosonDistribution(U, inputs) {
  const m = U.length
  const k = inputs.length
  return patterns(k, m).map((pattern) => {
    const rows = pattern.flatMap((count, mode) => range(count).map(() => mode))
    const sub = rows.map((r) => inputs.map((c) => U[r][c]))
    const norm = pattern.reduce((p, s) => p * factorial(s), 1)
    const boson = cabs2(permanent(sub)) / norm
    const dist = permanent(sub.map((row) => row.map((z) => cx(cabs2(z))))).re / norm
    return { pattern, boson, dist, collision: pattern.some((s) => s > 1) }
  })
}

export const beamSplitter = () => {
  const s = Math.SQRT1_2
  return [
    [cx(s), cx(0, s)],
    [cx(0, s), cx(s)],
  ]
}

/**
 * Hong–Ou–Mandel: probability both detectors click when two photons with
 * wave-packet overlap |⟨ψ₁|ψ₂⟩|² = v meet on a 50:50 beam splitter.
 */
export const homCoincidence = (v) => (1 - v) / 2

export const randomInterferometer = (m, seed) => haarUnitary(m, rng(seed))
