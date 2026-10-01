import { binaryEntropy, coin, range, rng, sample } from '../numeric'

/**
 * Key-distribution protocols as round-by-round simulations. Each qubit is
 * tracked as (basis, bit) -- Z or X basis, value 0 or 1 -- which is all a
 * BB84-family state needs. The one rule of quantum measurement used:
 * measure in the basis it was prepared in and you get its bit; measure in
 * the other basis and you get a fair coin.
 */

const measure = (rand, state, basis) => (state.basis === basis ? state.bit : coin(rand))

// --- BB84 -----------------------------------------------------------------------

export function bb84Run({ n = 400, eve = 0, seed = 1 } = {}) {
  const rand = rng(seed)
  const rounds = range(n).map(() => {
    const aliceBit = coin(rand)
    const aliceBasis = coin(rand) ? 'X' : 'Z'
    let state = { basis: aliceBasis, bit: aliceBit }
    const eveActive = rand() < eve
    let eveBasis = null
    if (eveActive) {
      eveBasis = coin(rand) ? 'X' : 'Z'
      state = { basis: eveBasis, bit: measure(rand, state, eveBasis) } // intercept-resend
    }
    const bobBasis = coin(rand) ? 'X' : 'Z'
    const bobBit = measure(rand, state, bobBasis)
    const kept = aliceBasis === bobBasis
    return { aliceBit, aliceBasis, eveActive, eveBasis, bobBasis, bobBit, kept, error: kept && aliceBit !== bobBit }
  })
  const sifted = rounds.filter((r) => r.kept)
  const errors = sifted.filter((r) => r.error).length
  const qber = sifted.length ? errors / sifted.length : 0
  return { rounds, sifted: sifted.length, errors, qber, secure: qber < BB84_THRESHOLD, keyRate: Math.max(0, 1 - 2 * binaryEntropy(qber)) }
}

/** Above ~11% QBER no one-way post-processing can distil a secret key. */
export const BB84_THRESHOLD = 0.11

/** Full intercept-resend: Eve guesses the wrong basis half the time, and then Bob is wrong half the time. */
export const bb84ExpectedQber = (eve) => eve * 0.25

// --- B92 ------------------------------------------------------------------------

/**
 * Two non-orthogonal states: bit 0 → |0⟩, bit 1 → |+⟩. Bob measures Z or X
 * at random; only the outcomes that rule one state out are conclusive:
 * Z gives 1 ⇒ it was |+⟩ ⇒ bit 1;  X gives − ⇒ it was |0⟩ ⇒ bit 0.
 */
export function b92Run({ n = 400, eve = 0, seed = 1 } = {}) {
  const rand = rng(seed)
  const rounds = range(n).map(() => {
    const aliceBit = coin(rand)
    let state = aliceBit ? { basis: 'X', bit: 0 } : { basis: 'Z', bit: 0 }
    const eveActive = rand() < eve
    if (eveActive) {
      const b = coin(rand) ? 'X' : 'Z'
      state = { basis: b, bit: measure(rand, state, b) }
    }
    const bobBasis = coin(rand) ? 'X' : 'Z'
    const outcome = measure(rand, state, bobBasis)
    let bobBit = null
    if (bobBasis === 'Z' && outcome === 1) bobBit = 1
    if (bobBasis === 'X' && outcome === 1) bobBit = 0 // outcome 1 in X = |−⟩
    const kept = bobBit !== null
    return { aliceBit, eveActive, bobBasis, outcome, bobBit, kept, error: kept && bobBit !== aliceBit }
  })
  const kept = rounds.filter((r) => r.kept)
  const errors = kept.filter((r) => r.error).length
  return { rounds, kept: kept.length, rate: kept.length / n, errors, qber: kept.length ? errors / kept.length : 0 }
}

// --- E91 ------------------------------------------------------------------------

export const E91_ALICE = [0, Math.PI / 4, Math.PI / 2]
export const E91_BOB = [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]

/**
 * Correlation ⟨A·B⟩ for measurement directions a, b (angles in the x–z
 * plane). Singlet: −cos(a − b). If Eve measured both halves in Z and resent
 * product states, the correlation drops to −cos a·cos b.
 */
export const e91Correlation = (a, b, eve = 0) => (1 - eve) * -Math.cos(a - b) + eve * -Math.cos(a) * Math.cos(b)

/** CHSH S built from Alice {0, π/2} and Bob {π/4, 3π/4}. |S| ≤ 2 classically. */
export function chsh(E) {
  return E(E91_ALICE[0], E91_BOB[0]) - E(E91_ALICE[0], E91_BOB[2]) + E(E91_ALICE[2], E91_BOB[0]) + E(E91_ALICE[2], E91_BOB[2])
}

export function e91Run({ n = 2000, eve = 0, seed = 1 } = {}) {
  const rand = rng(seed)
  const rounds = range(n).map(() => {
    const ai = Math.floor(rand() * 3)
    const bi = Math.floor(rand() * 3)
    const a = E91_ALICE[ai]
    const b = E91_BOB[bi]
    const eveActive = rand() < eve
    let A
    let B
    if (eveActive) {
      // Eve's Z measurement leaves |0⟩|1⟩ or |1⟩|0⟩; each side then independent.
      const first = coin(rand)
      const pPlus = (bit, angle) => (bit === 0 ? Math.cos(angle / 2) ** 2 : Math.sin(angle / 2) ** 2)
      A = rand() < pPlus(first, a) ? 1 : -1
      B = rand() < pPlus(1 - first, b) ? 1 : -1
    } else {
      A = coin(rand) ? 1 : -1
      const same = rand() < (1 - Math.cos(a - b)) / 2
      B = same ? A : -A
    }
    const keyPair = (ai === 1 && bi === 0) || (ai === 2 && bi === 1)
    return { ai, bi, A, B, eveActive, keyPair, error: keyPair && A !== -B }
  })
  const E = (ai, bi) => {
    const rs = rounds.filter((r) => r.ai === ai && r.bi === bi)
    return rs.length ? rs.reduce((s, r) => s + r.A * r.B, 0) / rs.length : 0
  }
  const S = E(0, 0) - E(0, 2) + E(2, 0) + E(2, 2)
  const key = rounds.filter((r) => r.keyPair)
  return { rounds, S, keyLength: key.length, qber: key.length ? key.filter((r) => r.error).length / key.length : 0 }
}

// --- MDI-QKD --------------------------------------------------------------------

const S2 = Math.SQRT1_2
const KET = { Z0: [1, 0], Z1: [0, 1], X0: [S2, S2], X1: [S2, -S2] }
export const BELL = {
  'Φ+': [S2, 0, 0, S2],
  'Φ−': [S2, 0, 0, -S2],
  'Ψ+': [0, S2, S2, 0],
  'Ψ−': [0, S2, -S2, 0],
}

/** Probabilities of Charlie's four Bell outcomes for Alice's and Bob's states. */
export function bellProbabilities(alice, bob) {
  const a = KET[alice.basis + alice.bit]
  const b = KET[bob.basis + bob.bit]
  const prod = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]]
  return Object.fromEntries(Object.entries(BELL).map(([k, v]) => [k, v.reduce((s, x, i) => s + x * prod[i], 0) ** 2]))
}

/**
 * Bob's flip rule after Charlie announces Ψ±: in Z, Ψ± means the bits
 * differ; in X, Ψ+ means equal and Ψ− means different.
 */
export const mdiFlip = (basis, outcome) => basis === 'Z' || outcome === 'Ψ−'

export function mdiRun({ n = 400, seed = 1 } = {}) {
  const rand = rng(seed)
  const rounds = range(n).map(() => {
    const alice = { basis: coin(rand) ? 'X' : 'Z', bit: coin(rand) }
    const bob = { basis: coin(rand) ? 'X' : 'Z', bit: coin(rand) }
    const outcome = sample(rand, bellProbabilities(alice, bob))
    // Linear optics can only tell Ψ+ and Ψ− apart; Φ± are lost.
    const announced = outcome === 'Ψ+' || outcome === 'Ψ−'
    const kept = announced && alice.basis === bob.basis
    const bobKey = kept ? (mdiFlip(bob.basis, outcome) ? 1 - bob.bit : bob.bit) : null
    return { alice, bob, outcome, announced, kept, bobKey, error: kept && bobKey !== alice.bit }
  })
  const kept = rounds.filter((r) => r.kept)
  return { rounds, kept: kept.length, success: rounds.filter((r) => r.announced).length / n, errors: kept.filter((r) => r.error).length }
}

// --- Decoy states ---------------------------------------------------------------

export const poisson = (mu, k) => {
  let p = Math.exp(-mu)
  for (let i = 1; i <= k; i++) p *= mu / i
  return p
}

/** Channel + detector transmittance for L km of fibre at 0.2 dB/km. */
export const transmittance = (L, detector = 0.1, alpha = 0.2) => detector * 10 ** ((-alpha * L) / 10)

/** Probability a pulse of mean photon number μ produces a click, honest channel. */
export const honestGain = (mu, eta, y0) => y0 + 1 - Math.exp(-eta * mu)

/**
 * Photon-number-splitting attack tuned to fake the signal gain: Eve blocks
 * every single-photon pulse (Bob sees only dark counts) and forwards a
 * multi-photon pulse with probability y, chosen so the *signal* gain looks
 * honest. Returns null if the distance is too short for her to manage.
 */
export function pnsAttack(muSignal, eta, y0) {
  const target = honestGain(muSignal, eta, y0)
  const low = Math.exp(-muSignal) * (1 + muSignal) // P(0) + P(1)
  const y = (target - y0 * low) / (1 - low)
  if (y > 1 || y < 0) return null
  return { y, gain: (mu) => y0 * Math.exp(-mu) * (1 + mu) + y * (1 - Math.exp(-mu) * (1 + mu)) }
}

/** Lo–Ma–Chen (2005) lower bound on the single-photon yield, weak + vacuum decoy. */
export const y1Lower = (mu, nu, Qmu, Qnu, y0) =>
  (mu / (mu * nu - nu * nu)) * (Qnu * Math.exp(nu) - Qmu * Math.exp(mu) * (nu * nu) / (mu * mu) - ((mu * mu - nu * nu) / (mu * mu)) * y0)

// --- Twin-field QKD (scaling model) ---------------------------------------------

export const channelEta = (L) => 10 ** ((-0.2 * L) / 10)

/** PLOB bound: the best any repeaterless protocol can do over loss η. */
export const plob = (eta) => -Math.log2(1 - eta)

/**
 * Toy secret-key models, ideal single photons and error correction, so only
 * the scaling with distance differs: BB84 sees the whole channel η; TF-QKD
 * pulses meet in the middle and each sees √η. Dark counts p_d per detection
 * window eventually swamp both.
 */
export function bb84Rate(L, { detector = 0.3, dark = 1e-8 } = {}) {
  const Q = channelEta(L) * detector + dark
  const e = dark / 2 / Q
  return Math.max(0, Q * (1 - 2 * binaryEntropy(e)))
}

export function tfRate(L, { detector = 0.3, dark = 1e-8 } = {}) {
  const Q = Math.sqrt(channelEta(L)) * detector + dark
  const e = dark / 2 / Q
  return Math.max(0, 0.5 * Q * (1 - 2 * binaryEntropy(e)))
}

/** Single-photon interference at the central node: click probability at D0. */
export const tfFringe = (deltaPhi, visibility = 1) => (1 + visibility * Math.cos(deltaPhi)) / 2

// --- Continuous-variable QKD (GG02, Gaussian collective attacks) -----------------

const G = (x) => (x <= 1 + 1e-12 ? 0 : ((x + 1) / 2) * Math.log2((x + 1) / 2) - ((x - 1) / 2) * Math.log2((x - 1) / 2))

/**
 * Coherent states, homodyne detection, reverse reconciliation, ideal
 * detector. Everything in shot-noise units. Formulas as in Lodewyck et al.,
 * PRA 76, 042305 (2007).
 */
export function cvRate({ VA = 10, T = 0.5, xi = 0.01, beta = 0.95 } = {}) {
  const V = VA + 1
  const chiLine = 1 / T - 1 + xi
  const chiTot = chiLine
  const IAB = 0.5 * Math.log2((V + chiTot) / (1 + chiTot))
  const A = V * V * (1 - 2 * T) + 2 * T + T * T * (V + chiLine) ** 2
  const B = T * T * (V * chiLine + 1) ** 2
  const root = (a, b) => {
    const d = Math.sqrt(Math.max(0, a * a - 4 * b))
    return [Math.sqrt((a + d) / 2), Math.sqrt(Math.max(0, (a - d) / 2))]
  }
  const [l1, l2] = root(A, B)
  const C = (V * Math.sqrt(B) + T * (V + chiLine)) / (T * (V + chiTot))
  const D = (Math.sqrt(B) * V) / (T * (V + chiTot))
  const [l3, l4] = root(C, D)
  const chiBE = G(l1) + G(l2) - G(l3) - G(l4)
  return { IAB, chiBE, K: beta * IAB - chiBE, lambdas: [l1, l2, l3, l4] }
}

/** Sample Alice's quadrature and Bob's homodyne result. */
export function cvSamples({ VA = 10, T = 0.5, xi = 0.01, n = 300, seed = 3 } = {}) {
  const rand = rng(seed)
  const g = () => {
    let u = 0
    while (u === 0) u = rand()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
  }
  return range(n).map(() => {
    const xa = g() * Math.sqrt(VA)
    return { xa, xb: Math.sqrt(T) * xa + g() * Math.sqrt(1 + T * xi) }
  })
}
