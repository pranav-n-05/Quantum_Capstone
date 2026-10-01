import { coin, range, rng } from '../numeric'

// --- Quantum secret sharing (Hillery–Bužek–Berthiaume 1999) --------------------

/**
 * A GHZ state (|000⟩ + |111⟩)/√2 shared by Alice, Bob and Charlie; each
 * measures X or Y at random. With an even number of Y's the three ±1 outcomes
 * multiply to a fixed sign -- +1 for XXX, −1 for XYY, YXY, YYX -- so Bob and
 * Charlie *together* can infer Alice's result. Either alone sees a coin flip.
 */
export const GHZ_SIGN = { XXX: 1, XYY: -1, YXY: -1, YYX: -1 }

export function secretSharingRun({ n = 200, seed = 1 } = {}) {
  const rand = rng(seed)
  const rounds = range(n).map(() => {
    const bases = range(3).map(() => (coin(rand) ? 'Y' : 'X'))
    const key = bases.join('')
    const sign = GHZ_SIGN[key]
    const mA = coin(rand) ? 1 : -1
    const mB = coin(rand) ? 1 : -1
    const mC = sign ? sign * mA * mB : coin(rand) ? 1 : -1
    return { bases: key, mA, mB, mC, valid: Boolean(sign), recovered: sign ? sign * mB * mC : null }
  })
  const valid = rounds.filter((r) => r.valid)
  return { rounds, valid: valid.length, correct: valid.filter((r) => r.recovered === r.mA).length }
}

// --- Quantum coin flipping (BB84-style) ----------------------------------------

/**
 * Alice's secret coin bit c chooses the basis (0 = Z, 1 = X) for k qubits
 * with random values. Bob measures each in a random basis, then announces a
 * guess g. Alice reveals c and the values; Bob checks every qubit he happened
 * to measure in basis c. The flip is c ⊕ g.
 *
 * A cheating Alice who claims the other basis must invent values for qubits
 * Bob measured "correctly" -- each such qubit catches her half the time, so
 * she survives with probability (3/4)ᵏ.
 */
export function coinFlipRun({ k = 8, cheat = false, seed = 1 } = {}) {
  const rand = rng(seed)
  const c = coin(rand)
  const values = range(k).map(() => coin(rand))
  const bobBases = range(k).map(() => coin(rand))
  const bobResults = values.map((v, i) => (bobBases[i] === c ? v : coin(rand)))
  const guess = coin(rand)
  const claimed = cheat ? 1 - c : c
  const claimedValues = cheat ? values.map((v, i) => (bobBases[i] === claimed ? coin(rand) : v)) : values
  const checks = range(k).filter((i) => bobBases[i] === claimed)
  const caught = checks.some((i) => bobResults[i] !== claimedValues[i])
  return { c, values, bobBases, bobResults, guess, claimed, checks, caught, outcome: claimed ^ guess }
}

export const coinFlipSurvival = (k) => 0.75 ** k

/** Kitaev: any strong coin-flipping protocol leaves some cheater a bias ≥ 1/√2 − 1/2. */
export const KITAEV_BIAS = Math.SQRT1_2 - 0.5

// --- Wiesner's quantum money ---------------------------------------------------

/**
 * Each note carries n qubits in secret BB84 states. A counterfeiter who
 * measures in a random basis and re-prepares passes each qubit with
 * probability 3/4 (and no attack does better -- Molina, Vidick & Watrous
 * 2012), so a forged note passes with (3/4)ⁿ.
 */
export function wiesnerAttempt({ n = 8, seed = 1 } = {}) {
  const rand = rng(seed)
  const qubits = range(n).map(() => {
    const basis = coin(rand) ? 'X' : 'Z'
    const bit = coin(rand)
    const guess = coin(rand) ? 'X' : 'Z'
    const read = guess === basis ? bit : coin(rand)
    const verified = guess === basis ? read : coin(rand) // bank measures the re-prepared qubit in `basis`
    return { basis, bit, guess, read, pass: verified === bit }
  })
  return { qubits, pass: qubits.every((q) => q.pass) }
}

export const wiesnerPass = (n) => 0.75 ** n
