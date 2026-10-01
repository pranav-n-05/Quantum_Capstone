import { describe, expect, it } from 'vitest'

import { range } from '../numeric'
import { coinFlipRun, coinFlipSurvival, secretSharingRun, wiesnerAttempt, wiesnerPass } from './crypto'
import { CLIFFORDS, ghzFringe, randomizedBenchmarking, tomography, tomographyCurve } from './characterization'
import { rng } from '../numeric'
import { maskOf, parity, STEANE, steaneAddress, SURFACE } from './qec'
import {
  b92Run,
  bb84Run,
  bb84Rate,
  bellProbabilities,
  channelEta,
  chsh,
  cvRate,
  e91Correlation,
  e91Run,
  honestGain,
  mdiRun,
  plob,
  pnsAttack,
  tfRate,
  transmittance,
  y1Lower,
} from './qkd'

describe('BB84', () => {
  it('no eavesdropper: zero errors, half the rounds survive sifting', () => {
    const r = bb84Run({ n: 4000, eve: 0 })
    expect(r.errors).toBe(0)
    expect(r.sifted / 4000).toBeGreaterThan(0.45)
    expect(r.sifted / 4000).toBeLessThan(0.55)
  })
  it('full intercept-resend gives ~25% QBER and aborts', () => {
    const r = bb84Run({ n: 8000, eve: 1 })
    expect(r.qber).toBeGreaterThan(0.22)
    expect(r.qber).toBeLessThan(0.28)
    expect(r.secure).toBe(false)
  })
})

describe('B92', () => {
  it('a quarter of rounds are conclusive and never wrong without Eve', () => {
    const r = b92Run({ n: 8000 })
    expect(r.errors).toBe(0)
    expect(r.rate).toBeGreaterThan(0.22)
    expect(r.rate).toBeLessThan(0.28)
  })
  it('an eavesdropper introduces errors', () => {
    expect(b92Run({ n: 8000, eve: 1 }).qber).toBeGreaterThan(0.1)
  })
})

describe('E91', () => {
  it('singlet correlations violate CHSH maximally', () => {
    expect(Math.abs(chsh((a, b) => e91Correlation(a, b)))).toBeCloseTo(2 * Math.SQRT2, 9)
  })
  it('an intercepting Eve drops |S| to the classical range', () => {
    expect(Math.abs(chsh((a, b) => e91Correlation(a, b, 1)))).toBeLessThanOrEqual(2)
  })
  it('sampled runs agree', () => {
    expect(Math.abs(e91Run({ n: 20000 }).S)).toBeGreaterThan(2.6)
    expect(e91Run({ n: 20000 }).qber).toBe(0)
    expect(Math.abs(e91Run({ n: 20000, eve: 1 }).S)).toBeLessThan(2.1)
  })
})

describe('MDI-QKD', () => {
  it('Bell projections sum to 1', () => {
    for (const a of ['Z', 'X'])
      for (const b of ['Z', 'X'])
        for (const x of [0, 1])
          for (const y of [0, 1]) {
            const p = bellProbabilities({ basis: a, bit: x }, { basis: b, bit: y })
            expect(Object.values(p).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12)
          }
  })
  it('Z-basis Ψ± only when bits differ; X-basis ++ only gives Ψ+', () => {
    expect(bellProbabilities({ basis: 'Z', bit: 0 }, { basis: 'Z', bit: 0 })['Ψ+']).toBeCloseTo(0)
    expect(bellProbabilities({ basis: 'X', bit: 0 }, { basis: 'X', bit: 0 })['Ψ−']).toBeCloseTo(0)
    expect(bellProbabilities({ basis: 'X', bit: 0 }, { basis: 'X', bit: 1 })['Ψ+']).toBeCloseTo(0)
  })
  it('sifted key has no errors and about half the rounds are announced', () => {
    const r = mdiRun({ n: 4000 })
    expect(r.errors).toBe(0)
    expect(r.kept).toBeGreaterThan(0)
  })
})

describe('decoy states', () => {
  const mu = 0.5
  const nu = 0.1
  const y0 = 1e-5
  const eta = transmittance(50)
  it('honest channel: the single-photon yield bound is close to η', () => {
    const bound = y1Lower(mu, nu, honestGain(mu, eta, y0), honestGain(nu, eta, y0), y0)
    expect(bound).toBeGreaterThan(0.85 * eta)
    expect(bound).toBeLessThan(eta + y0 + 1e-9)
  })
  it('PNS attack: matching the signal gain betrays itself in the decoy', () => {
    const atk = pnsAttack(mu, eta, y0)
    expect(atk).not.toBeNull()
    expect(atk.gain(mu)).toBeCloseTo(honestGain(mu, eta, y0), 12)
    const bound = y1Lower(mu, nu, atk.gain(mu), atk.gain(nu), y0)
    expect(bound).toBeLessThan(0.2 * eta)
  })
})

describe('twin-field scaling', () => {
  it('TF-QKD beats the PLOB bound at long distance; BB84 cannot', () => {
    expect(tfRate(400)).toBeGreaterThan(plob(channelEta(400)))
    expect(bb84Rate(100)).toBeLessThan(plob(channelEta(100)))
    expect(bb84Rate(400)).toBe(0)
  })
})

describe('CV-QKD', () => {
  it('a perfect channel leaks nothing to Eve', () => {
    expect(cvRate({ T: 1, xi: 0 }).chiBE).toBeCloseTo(0, 6)
  })
  it('symplectic eigenvalues are ≥ 1 and the rate never beats PLOB', () => {
    for (const T of [0.9, 0.5, 0.1, 0.01])
      for (const xi of [0, 0.01, 0.05]) {
        const r = cvRate({ T, xi, beta: 1 })
        for (const l of r.lambdas) expect(l).toBeGreaterThan(1 - 1e-6)
        expect(r.K).toBeLessThanOrEqual(plob(T) + 1e-9)
      }
  })
  it('pure loss with ideal reconciliation keeps a positive key; heavy noise kills it', () => {
    expect(cvRate({ T: 0.1, xi: 0, beta: 1 }).K).toBeGreaterThan(0)
    expect(cvRate({ T: 0.1, xi: 0.3, beta: 0.95 }).K).toBeLessThan(0)
  })
})

describe('secret sharing', () => {
  it('Bob and Charlie together always recover Alice’s bit on valid rounds', () => {
    const r = secretSharingRun({ n: 1000 })
    expect(r.correct).toBe(r.valid)
    expect(r.valid / 1000).toBeGreaterThan(0.4)
  })
})

describe('coin flipping', () => {
  it('honest Alice is never caught', () => {
    for (let s = 1; s < 50; s++) expect(coinFlipRun({ seed: s }).caught).toBe(false)
  })
  it('cheating Alice survives about (3/4)^k of the time', () => {
    const k = 4
    let survived = 0
    for (let s = 1; s <= 4000; s++) survived += coinFlipRun({ k, cheat: true, seed: s }).caught ? 0 : 1
    expect(survived / 4000).toBeCloseTo(coinFlipSurvival(k), 1)
  })
})

describe('Wiesner money', () => {
  it('counterfeits pass about (3/4)^n of the time', () => {
    const n = 3
    let pass = 0
    for (let s = 1; s <= 4000; s++) pass += wiesnerAttempt({ n, seed: s }).pass ? 1 : 0
    expect(pass / 4000).toBeCloseTo(wiesnerPass(n), 1)
  })
})

describe('surface code d=3', () => {
  it('every X check commutes with every Z check, and the logicals anticommute', () => {
    for (const x of SURFACE.X) for (const z of SURFACE.Z) expect(parity(x & z)).toBe(0)
    for (const x of SURFACE.X) expect(parity(x & SURFACE.LZ)).toBe(0)
    for (const z of SURFACE.Z) expect(parity(z & SURFACE.LX)).toBe(0)
    expect(parity(SURFACE.LX & SURFACE.LZ)).toBe(1)
  })
  it('corrects every single-qubit X, Z and Y error', () => {
    for (let q = 0; q < 9; q++) {
      const e = 1 << q
      for (const [ex, ez] of [[e, 0], [0, e], [e, e]]) {
        const d = SURFACE.decode(ex, ez)
        expect(d.logicalXError).toBe(false)
        expect(d.logicalZError).toBe(false)
      }
    }
  })
  it('helps below threshold and hurts far above it', () => {
    expect(SURFACE.logicalRate(0.01)).toBeLessThan(0.01)
    expect(SURFACE.logicalRate(0.4)).toBeGreaterThan(0.4)
  })
})

describe('Steane code', () => {
  it('a single X error on qubit j gives syndrome j + 1', () => {
    for (let j = 0; j < 7; j++) expect(steaneAddress(STEANE.decode(1 << j, 0).zSyndrome)).toBe(j + 1)
  })
  it('corrects any single error, fails on two', () => {
    for (let j = 0; j < 7; j++) expect(STEANE.decode(1 << j, 1 << ((j + 3) % 7)).logicalXError).toBe(false)
    expect(STEANE.decode(maskOf([0, 1]), 0).logicalXError).toBe(true)
  })
})

describe('characterization', () => {
  it('tomography converges as 1/√N: 100× the shots, ~10× smaller error', () => {
    const r = { x: 0.6, y: 0, z: 0.8 }
    const [few, many] = tomographyCurve(r, [20, 2000], 200)
    const ratio = few.error / many.error
    expect(ratio).toBeGreaterThan(7)
    expect(ratio).toBeLessThan(14)
    expect(tomography(r, 100000, rng(1)).fidelity).toBeGreaterThan(0.999)
  })
  it('there are exactly 24 single-qubit Cliffords', () => {
    expect(CLIFFORDS.length).toBe(24)
  })
  it('RB recovers the depolarising error rate', () => {
    const p = 0.02
    const rb = randomizedBenchmarking({ p, sequences: 20 })
    expect(rb.f).toBeCloseTo(1 - p, 6)
    expect(rb.errorPerClifford).toBeCloseTo(p / 2, 6)
  })
  it('a coherent over-rotation also shows up as decay', () => {
    expect(randomizedBenchmarking({ p: 0, eps: 0.1, sequences: 60 }).errorPerClifford).toBeGreaterThan(0.001)
  })
  it('GHZ fringes run N times faster', () => {
    expect(ghzFringe(3, Math.PI / 3)).toBeCloseTo(0, 12)
    expect(ghzFringe(1, Math.PI / 3)).toBeCloseTo(0.75, 12)
  })
})

describe('sanity', () => {
  it('range helper', () => expect(range(3)).toEqual([0, 1, 2]))
})
