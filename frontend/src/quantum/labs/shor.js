import { convergents, gcd, modPow } from '../numeric'

/**
 * The classical half of Shor's algorithm: turn one measured integer m (out
 * of 2ᵗ) into a guess for the period r, check it, and try to split N.
 */
export function shorPostProcess(m, t, a, N) {
  const Q = 2 ** t
  const steps = { m, phase: m / Q }
  if (m === 0) return { ...steps, ok: false, reason: 'm = 0 carries no information about r — run again.' }
  const fractions = convergents(m, Q).filter(([, q]) => q > 0 && q < N)
  steps.fractions = fractions
  let r = 0
  for (const [, q] of fractions) {
    for (let mult = 1; mult * q <= N; mult++) {
      if (modPow(a, mult * q, N) === 1) {
        r = mult * q
        break
      }
    }
    if (r) break
  }
  if (!r) return { ...steps, ok: false, reason: 'No convergent gave a valid period — run again.' }
  steps.r = r
  if (r % 2 === 1) return { ...steps, ok: false, reason: `r = ${r} is odd — pick another a.` }
  const half = modPow(a, r / 2, N)
  if (half === N - 1) return { ...steps, ok: false, reason: `a^(r/2) ≡ −1 (mod ${N}) — only trivial factors. Pick another a.` }
  const f1 = gcd(half - 1, N)
  const f2 = gcd(half + 1, N)
  return { ...steps, ok: f1 > 1 && f1 < N, half, factors: [f1, f2].sort((x, y) => x - y) }
}
