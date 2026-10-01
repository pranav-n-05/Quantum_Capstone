/**
 * Small numerical tools the library's labs share: a seeded RNG (so every
 * simulated experiment is reproducible -- a professor sees the same table you
 * did), number theory for Shor, linear algebra over GF(2) for Simon, a real
 * symmetric eigensolver, and complex-matrix helpers for photonics.
 */

// --- randomness ---------------------------------------------------------------

/** mulberry32: tiny, fast, good enough for teaching simulations. */
export function rng(seed = 1) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal sample (Box–Muller). */
export function gaussian(rand) {
  let u = 0
  while (u === 0) u = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

export const coin = (rand, p = 0.5) => (rand() < p ? 1 : 0)

/** Index sampled from a probability vector (or object of probabilities). */
export function sample(rand, probs) {
  const entries = Array.isArray(probs) ? probs.map((p, i) => [i, p]) : Object.entries(probs)
  let r = rand()
  for (const [k, p] of entries) {
    r -= p
    if (r <= 0) return k
  }
  return entries[entries.length - 1][0]
}

/** Number of successes in `n` trials of probability `p`. */
export function binomial(rand, n, p) {
  let k = 0
  for (let i = 0; i < n; i++) if (rand() < p) k++
  return k
}

// --- number theory ------------------------------------------------------------

export const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b))

export function modPow(base, exp, mod) {
  let result = 1
  let b = base % mod
  let e = exp
  while (e > 0) {
    if (e & 1) result = (result * b) % mod
    b = (b * b) % mod
    e >>= 1
  }
  return result
}

/** Multiplicative order of a mod N (smallest r > 0 with aʳ ≡ 1), or 0. */
export function order(a, N) {
  if (gcd(a, N) !== 1) return 0
  let x = a % N
  for (let r = 1; r <= N; r++) {
    if (x === 1) return r
    x = (x * a) % N
  }
  return 0
}

export function modInverse(a, m) {
  for (let x = 1; x < m; x++) if ((a * x) % m === 1) return x
  return 0
}

/**
 * Convergents of the continued fraction of num/den, as [p, q] pairs. Shor's
 * classical post-processing reads the period off the first denominator that
 * works.
 */
export function convergents(num, den) {
  const terms = []
  let a = num
  let b = den
  while (b !== 0) {
    terms.push(Math.floor(a / b))
    ;[a, b] = [b, a % b]
  }
  const out = []
  let [p0, q0, p1, q1] = [0, 1, 1, 0]
  for (const t of terms) {
    ;[p0, p1] = [p1, t * p1 + p0]
    ;[q0, q1] = [q1, t * q1 + q0]
    out.push([p1, q1])
  }
  return out
}

// --- GF(2) --------------------------------------------------------------------

export const dot2 = (a, b) => {
  let x = a & b
  let parity = 0
  while (x) {
    parity ^= x & 1
    x >>= 1
  }
  return parity
}

/** Rank over GF(2) of a list of n-bit integers. */
export function rank2(vectors) {
  const basis = []
  for (let v of vectors) {
    for (const b of basis) v = Math.min(v, v ^ b)
    if (v) basis.push(v)
  }
  return basis.length
}

/** Every non-zero s with s·y = 0 for all y -- Simon's candidate secrets. */
export function nullSpace2(vectors, n) {
  const out = []
  for (let s = 1; s < 1 << n; s++) if (vectors.every((y) => dot2(s, y) === 0)) out.push(s)
  return out
}

// --- real symmetric eigensolver -----------------------------------------------

/**
 * Cyclic Jacobi eigen-decomposition of a real symmetric matrix.
 * Returns { values, vectors } with vectors[k] the k-th eigenvector (column),
 * sorted by ascending eigenvalue.
 */
export function eigSym(A) {
  const n = A.length
  const a = A.map((row) => row.slice())
  const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] ** 2
    if (off < 1e-24) break
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q])
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < n; k++) {
          const akp = a[k][p]
          const akq = a[k][q]
          a[k][p] = c * akp - s * akq
          a[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k]
          const aqk = a[q][k]
          a[p][k] = c * apk - s * aqk
          a[q][k] = s * apk + c * aqk
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p]
          const vkq = v[k][q]
          v[k][p] = c * vkp - s * vkq
          v[k][q] = s * vkp + c * vkq
        }
      }
    }
  }
  const order_ = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[i][i] - a[j][j])
  return {
    values: order_.map((i) => a[i][i]),
    vectors: order_.map((i) => v.map((row) => row[i])),
  }
}

// --- complex matrices (arrays of {re, im}) --------------------------------------

export const cx = (re, im = 0) => ({ re, im })
const cmul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)
const cadd = (a, b) => cx(a.re + b.re, a.im + b.im)
export const cabs2 = (a) => a.re * a.re + a.im * a.im

/** e^{i·t·A} for real symmetric A, as a complex matrix -- HHL and QPCA need it. */
export function expiSym(A, t) {
  const { values, vectors } = eigSym(A)
  const n = A.length
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      values.reduce((acc, lam, k) => {
        const w = vectors[k][i] * vectors[k][j]
        return cadd(acc, cx(w * Math.cos(lam * t), w * Math.sin(lam * t)))
      }, cx(0)),
    ),
  )
}

/** Permanent of a small complex matrix (≤ 4×4 here) by brute force. */
export function permanent(M) {
  const n = M.length
  if (n === 0) return cx(1)
  let total = cx(0)
  const perm = (row, used, acc) => {
    if (row === n) {
      total = cadd(total, acc)
      return
    }
    for (let j = 0; j < n; j++) {
      if (used & (1 << j)) continue
      perm(row + 1, used | (1 << j), cmul(acc, M[row][j]))
    }
  }
  perm(0, 0, cx(1))
  return total
}

/**
 * Haar-random n×n unitary: Gram–Schmidt on a complex Gaussian matrix. Plain
 * Gram–Schmidt leaves R with a positive real diagonal, which is exactly the
 * phase fix that makes the result Haar-distributed.
 */
export function haarUnitary(n, rand) {
  const cols = Array.from({ length: n }, () => Array.from({ length: n }, () => cx(gaussian(rand), gaussian(rand))))
  const q = []
  for (const v of cols) {
    let w = v.slice()
    for (const u of q) {
      // proj = <u, w> u
      const ip = u.reduce((acc, ui, k) => cadd(acc, cmul(cx(ui.re, -ui.im), w[k])), cx(0))
      w = w.map((wk, k) => cx(wk.re - (ip.re * u[k].re - ip.im * u[k].im), wk.im - (ip.re * u[k].im + ip.im * u[k].re)))
    }
    const norm = Math.sqrt(w.reduce((s, z) => s + cabs2(z), 0))
    q.push(w.map((z) => cx(z.re / norm, z.im / norm)))
  }
  // q[j] is column j: U[i][j] = q[j][i]
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => q[j][i]))
}

// --- misc -----------------------------------------------------------------------

export const binaryEntropy = (p) => (p <= 0 || p >= 1 ? 0 : -p * Math.log2(p) - (1 - p) * Math.log2(1 - p))

/** Least-squares slope and intercept of y on x. */
export function linearFit(xs, ys) {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
  }
  const slope = sxy / sxx
  return { slope, intercept: my - slope * mx }
}

export const range = (n) => Array.from({ length: n }, (_, i) => i)
