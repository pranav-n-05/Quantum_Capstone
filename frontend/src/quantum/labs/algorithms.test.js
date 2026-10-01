import { describe, expect, it } from 'vitest'

import { convergents, eigSym, gcd, nullSpace2, order, permanent, cx, rank2, haarUnitary, rng } from '../numeric'
import { expectPauli } from '../pauli'
import { applyOps, permute, zeroState, probabilities } from '../statevector'
import { beamSplitter, bosonDistribution, homCoincidence, patterns, randomInterferometer } from './boson'
import { exactState, infidelity, trotterState, zExpect } from './hamsim'
import { featureState, makeDataset, qpcaRho, quantumKernel, svmDecision, trainSvm } from './ml'
import { shorPostProcess } from './shor'
import { bestAngles, CHEMICAL_ACCURACY, cutValue, exactGroundEnergy, expectedCut, GRAPHS, maxCut, runVqe, vqeEnergy } from './variational'
import { classicalWalk, hadamardWalk, spread } from './walks'

const sum = (xs) => xs.reduce((a, b) => a + b, 0)

describe('engine extensions', () => {
  it('perm maps a register value, leaving other qubits alone', () => {
    let s = applyOps(zeroState(3), [{ g: 'x', t: [0] }]) // q0=1 → register (q0,q1) value 1
    s = permute(s, [0, 1], [0, 2, 3, 1]) // 1 → 2
    expect(probabilities(s)[0b010]).toBeCloseTo(1)
  })

  it('negative controls fire only when the control is 0', () => {
    const s = applyOps(zeroState(2), [{ g: 'x', t: [1], nc: [0] }])
    expect(probabilities(s)[0b10]).toBeCloseTo(1)
    const t = applyOps(zeroState(2), [{ g: 'x', t: [0] }, { g: 'x', t: [1], nc: [0] }])
    expect(probabilities(t)[0b01]).toBeCloseTo(1)
  })

  it('pauli expectations', () => {
    expect(expectPauli(zeroState(2), 'ZI')).toBeCloseTo(1)
    const plus = applyOps(zeroState(1), [{ g: 'h', t: [0] }])
    expect(expectPauli(plus, 'X')).toBeCloseTo(1)
  })
})

describe('numeric', () => {
  it('number theory', () => {
    expect(gcd(48, 15)).toBe(3)
    expect(order(7, 15)).toBe(4)
    expect(convergents(3, 4).at(-1)).toEqual([3, 4])
  })

  it('GF(2) null space recovers a Simon secret', () => {
    // y·s = 0 for s = 110: y ∈ {000, 001, 110, 111}
    expect(nullSpace2([0b001, 0b110], 3)).toEqual([0b110])
    expect(rank2([0b001, 0b110, 0b111])).toBe(2)
  })

  it('eigSym diagonalises', () => {
    const { values } = eigSym([[2, 1], [1, 2]])
    expect(values[0]).toBeCloseTo(1)
    expect(values[1]).toBeCloseTo(3)
  })

  it('haar unitaries are unitary', () => {
    const U = haarUnitary(4, rng(5))
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        let re = 0
        let im = 0
        for (let k = 0; k < 4; k++) {
          re += U[k][i].re * U[k][j].re + U[k][i].im * U[k][j].im
          im += U[k][i].re * U[k][j].im - U[k][i].im * U[k][j].re
        }
        expect(re).toBeCloseTo(i === j ? 1 : 0, 9)
        expect(im).toBeCloseTo(0, 9)
      }
  })

  it('permanent', () => {
    expect(permanent([[cx(1), cx(2)], [cx(3), cx(4)]]).re).toBeCloseTo(10)
  })
})

describe('shor post-processing', () => {
  it('a = 7, m = 2 of 8 → r = 4 → 15 = 3 × 5', () => {
    const r = shorPostProcess(2, 3, 7, 15)
    expect(r.r).toBe(4)
    expect(r.factors).toEqual([3, 5])
  })
  it('a = 14 has r = 2 but a^(r/2) ≡ −1: trivial', () => {
    const r = shorPostProcess(4, 3, 14, 15)
    expect(r.ok).toBe(false)
  })
  it('m = 0 is uninformative', () => {
    expect(shorPostProcess(0, 3, 7, 15).ok).toBe(false)
  })
})

describe('VQE', () => {
  const exact = exactGroundEnergy()
  it('the H2 ground energy is about −1.857 Ha', () => {
    expect(exact).toBeCloseTo(-1.8573, 3)
  })
  it('the ansatz can reach the exact ground state', () => {
    let best = Infinity
    for (let k = 0; k <= 3600; k++) best = Math.min(best, vqeEnergy((2 * Math.PI * k) / 3600))
    expect(best - exact).toBeLessThan(1e-5)
  })
  it('parameter-shift gradient descent converges within chemical accuracy', () => {
    const trace = runVqe({ theta0: 0.3, iterations: 40 })
    expect(trace.at(-1).energy - exact).toBeLessThan(CHEMICAL_ACCURACY)
  })
})

describe('QAOA', () => {
  for (const [id, g] of Object.entries(GRAPHS)) {
    it(`${id}: optimised p=1 beats random guessing`, () => {
      const best = bestAngles(g)
      const random = g.edges.length / 2
      expect(best.value).toBeGreaterThan(random + 0.3)
      expect(best.value).toBeLessThanOrEqual(maxCut(g) + 1e-9)
    })
  }
  it('cut values', () => {
    expect(cutValue(0b0101, GRAPHS.ring.edges)).toBe(4)
    expect(maxCut(GRAPHS.kite)).toBe(3)
    expect(expectedCut(GRAPHS.ring, 0, 0)).toBeCloseTo(2)
  })
})

describe('quantum walk', () => {
  it('conserves probability and spreads faster than a classical walk', () => {
    const q = hadamardWalk(20)
    const c = classicalWalk(20)
    expect(sum(q.probs)).toBeCloseTo(1, 9)
    expect(sum(c.probs)).toBeCloseTo(1, 9)
    expect(spread(q)).toBeGreaterThan(2 * spread(c))
  })
  it('symmetric coin gives a symmetric distribution', () => {
    const { probs } = hadamardWalk(15)
    for (let i = 0; i < probs.length; i++) expect(probs[i]).toBeCloseTo(probs[probs.length - 1 - i], 9)
  })
})

describe('Hamiltonian simulation', () => {
  const J = 1
  const h = 1
  const t = 1.5
  const exact = exactState(J, h, t)
  it('exact evolution is normalised', () => {
    expect(sum([...probabilities(exact)])).toBeCloseTo(1, 9)
  })
  it('first-order Trotter error shrinks roughly as 1/n²', () => {
    const e4 = infidelity(exact, trotterState(J, h, t, 4))
    const e16 = infidelity(exact, trotterState(J, h, t, 16))
    expect(e16).toBeLessThan(e4 / 8)
    expect(infidelity(exact, trotterState(J, h, t, 64))).toBeLessThan(1e-3)
  })
  it('second order beats first order at the same step count', () => {
    expect(infidelity(exact, trotterState(J, h, t, 8, 2))).toBeLessThan(infidelity(exact, trotterState(J, h, t, 8, 1)))
  })
  it('⟨Z₀⟩ starts at 1', () => {
    expect(zExpect(exactState(J, h, 0))).toBeCloseTo(1)
  })
})

describe('quantum kernel + SVM', () => {
  it('kernel is 1 on the diagonal, symmetric and in [0, 1]', () => {
    const a = [1, 2]
    const b = [3, 0.5]
    expect(quantumKernel(a, a)).toBeCloseTo(1)
    expect(quantumKernel(a, b)).toBeCloseTo(quantumKernel(b, a))
    expect(quantumKernel(a, b)).toBeGreaterThanOrEqual(0)
    expect(quantumKernel(a, b)).toBeLessThanOrEqual(1 + 1e-12)
  })
  it('the SVM fits its training set', () => {
    const data = makeDataset()
    const states = data.map((p) => featureState(p.x))
    const K = states.map((a) => states.map((b) => quantumKernel(a, b)))
    const y = data.map((p) => p.y)
    const model = trainSvm(K, y)
    const acc = data.filter((p, i) => Math.sign(svmDecision(model, y, K[i])) === p.y).length / data.length
    expect(acc).toBeGreaterThanOrEqual(0.9)
  })
})

describe('QPCA', () => {
  it('ρ has trace 1 and eigenvalues ¾, ¼', () => {
    const rho = qpcaRho(0.5)
    expect(rho[0][0] + rho[1][1]).toBeCloseTo(1)
    const { values } = eigSym(rho)
    expect(values[0]).toBeCloseTo(0.25)
    expect(values[1]).toBeCloseTo(0.75)
  })
})

describe('boson sampling', () => {
  it('Hong–Ou–Mandel: identical photons never split', () => {
    const d = bosonDistribution(beamSplitter(), [0, 1])
    const split = d.find((o) => o.pattern[0] === 1 && o.pattern[1] === 1)
    expect(split.boson).toBeCloseTo(0, 12)
    expect(split.dist).toBeCloseTo(0.5, 12)
    expect(homCoincidence(1)).toBe(0)
  })
  it('both distributions are normalised for a random 6-mode interferometer', () => {
    const d = bosonDistribution(randomInterferometer(6, 42), [0, 1, 2])
    expect(d.length).toBe(patterns(3, 6).length)
    expect(sum(d.map((o) => o.boson))).toBeCloseTo(1, 9)
    expect(sum(d.map((o) => o.dist))).toBeCloseTo(1, 9)
  })
})
