import { describe, expect, it } from 'vitest'

import { applyUnitary, drive, driveUnitary, fidelity, fromAmplitudes, fromAngles, KET, relax, rotationOf, toAmplitudes } from './bloch'
import { CHALLENGES } from '../components/bloch/challenges'
import { axisRotation, MATRICES, rx, ry, rz, u } from './gates'
import { applyOps, blochVector, probabilities, vectorLength, zeroState } from './statevector'
import { marginal, runSteps } from './run'
import { ALGORITHMS, defaultParams, PROTOCOLS, PURE_ALGORITHMS, TRACK_ORDER, TRACKS } from '../components/algorithms/library'

const close = (a, b, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps)
const closeVec = (a, b, eps = 1e-9) => {
  close(a.x, b.x, eps)
  close(a.y, b.y, eps)
  close(a.z, b.z, eps)
}

describe('statevector', () => {
  it('H on |0⟩ gives an equal superposition', () => {
    const s = applyOps(zeroState(1), [{ g: 'h', t: [0] }])
    const p = probabilities(s)
    close(p[0], 0.5)
    close(p[1], 0.5)
  })

  it('qubit 0 is the least-significant bit', () => {
    const s = applyOps(zeroState(3), [{ g: 'x', t: [0] }])
    close(probabilities(s)[1], 1) // |001⟩
  })

  it('preserves the norm through a random-ish circuit', () => {
    const s = applyOps(zeroState(3), [
      { g: 'h', t: [0] },
      { g: 'ry', t: [1], angle: 1.1 },
      { g: 'cx', c: [0], t: [2] },
      { g: 'cp', c: [1], t: [0], angle: 0.7 },
      { g: 'cz', c: [0, 1], t: [2] },
      { g: 'swap', t: [0, 2] },
      { g: 'u', t: [1], params: [0.3, 1.2, -0.4] },
    ])
    close(probabilities(s).reduce((a, b) => a + b, 0), 1)
  })

  it('reduced Bloch vectors of a Bell pair are zero (maximally entangled)', () => {
    const s = applyOps(zeroState(2), [{ g: 'h', t: [0] }, { g: 'cx', c: [0], t: [1] }])
    close(vectorLength(blochVector(s, 0)), 0)
    close(vectorLength(blochVector(s, 1)), 0)
  })

  it('reduced Bloch vector matches the single-qubit picture for product states', () => {
    const s = applyOps(zeroState(2), [{ g: 'h', t: [1] }, { g: 's', t: [1] }])
    closeVec(blochVector(s, 1), KET.plusI)
    closeVec(blochVector(s, 0), KET.zero)
  })
})

describe('bloch geometry', () => {
  const gates = {
    x: MATRICES.x,
    y: MATRICES.y,
    z: MATRICES.z,
    h: MATRICES.h,
    s: MATRICES.s,
    t: MATRICES.t,
    rx: rx(0.7),
    ry: ry(-1.3),
    rz: rz(2.2),
    u: u(0.4, 1.9, -0.6),
    axis: axisRotation([0.6, 0, 0.8], 1.0),
  }
  const starts = [KET.zero, KET.plus, fromAngles(1.0, 2.0), fromAngles(2.5, -0.8)]

  for (const [name, U] of Object.entries(gates)) {
    it(`rotationOf(${name}) agrees with applying the matrix to amplitudes`, () => {
      for (const v of starts) {
        const [a, b] = toAmplitudes(v)
        const mulc = (m, z) => ({ re: m.re * z.re - m.im * z.im, im: m.re * z.im + m.im * z.re })
        const addc = (p, q) => ({ re: p.re + q.re, im: p.im + q.im })
        const a2 = addc(mulc(U[0][0], a), mulc(U[0][1], b))
        const b2 = addc(mulc(U[1][0], a), mulc(U[1][1], b))
        closeVec(applyUnitary(v, U), fromAmplitudes([a2, b2]), 1e-9)
      }
    })
  }

  it('X is a half-turn about x̂', () => {
    const { axis, angle } = rotationOf(MATRICES.x)
    close(Math.abs(angle), Math.PI)
    close(Math.abs(axis[0]), 1)
  })

  it('T1/T2 relaxation pulls |1⟩ toward |0⟩ and shrinks the equator', () => {
    const r = relax(KET.plus, { t1: 100, t2: 50 }, 50)
    close(r.x, Math.exp(-1))
    close(r.z, 1 - Math.exp(-0.5))
  })
})

describe('algorithm library', () => {
  for (const algorithm of ALGORITHMS) {
    // Exercise every option of every knob, not just the defaults.
    const combos = algorithm.params.reduce(
      (acc, p) => acc.flatMap((c) => p.options.map((o) => ({ ...c, [p.key]: o.value }))),
      [{}],
    )

    for (const params of combos) {
      it(`${algorithm.id} ${JSON.stringify(params)} gives its advertised answer`, () => {
        const built = algorithm.build({ ...defaultParams(algorithm), ...params })
        const states = runSteps(built.qubits, built.steps)
        const final = states[states.length - 1]
        const dist = marginal(final, built.readout)
        const { answer } = built

        if (answer.bits && answer.exact !== false) {
          const hit = answer.bits.reduce((sum, b) => sum + (dist[b] ?? 0), 0)
          if (algorithm.id === 'grover') {
            const expected = { 1: 0.78125, 2: 0.9453125, 3: 0.330078125, 4: 0.01220703125 }[params.iterations]
            close(hit, expected, 1e-6)
          } else {
            close(hit, 1, 1e-9)
          }
        }
        if (answer.bits && answer.exact === false) {
          const best = Object.entries(dist).sort((a, b) => b[1] - a[1])[0][0]
          expect(best).toBe(answer.bits[0])
        }
        if (answer.notBits) close(dist[answer.notBits[0]] ?? 0, 0)
        if (built.target) {
          closeVec(blochVector(final, built.target.qubit), fromAngles(built.target.theta, built.target.phi))
        }
      })
    }
  }

  it('QFT matches the textbook definition', () => {
    const qft = ALGORITHMS.find((a) => a.id === 'qft')
    for (let x = 0; x < 8; x++) {
      const built = qft.build({ input: String(x) })
      const final = runSteps(built.qubits, built.steps).at(-1)
      for (let y = 0; y < 8; y++) {
        const angle = (2 * Math.PI * x * y) / 8
        close(final.re[y], Math.cos(angle) / Math.sqrt(8))
        close(final.im[y], Math.sin(angle) / Math.sqrt(8))
      }
    }
  })
})

describe('grover display phase', () => {
  it('after the optimal rounds the marked amplitude is positive, not just large', () => {
    const grover = ALGORITHMS.find((a) => a.id === 'grover')
    const built = grover.build({ marked: '110', iterations: '2' })
    const final = runSteps(built.qubits, built.steps).at(-1)
    expect(final.re[0b110]).toBeGreaterThan(0.9)
  })
})

describe('bloch challenges', () => {
  // A known solution for each challenge, within budget and allowed gates.
  const SOLUTIONS = {
    flip: [MATRICES.x],
    plus: [MATRICES.h],
    minus: [MATRICES.h, MATRICES.z],
    plusI: [MATRICES.h, MATRICES.s],
    'no-sdg': [MATRICES.h, MATRICES.s, MATRICES.z],
    magic: [MATRICES.h, MATRICES.t],
    home: [MATRICES.sdg, MATRICES.h],
    tilt: [ry(Math.PI / 3)],
    side: [rx((-2 * Math.PI) / 3)],
    universal: [u((3 * Math.PI) / 4, -Math.PI / 3, 0)],
  }
  for (const challenge of CHALLENGES) {
    it(`"${challenge.title}" is solvable within its budget`, () => {
      const path = SOLUTIONS[challenge.id]
      expect(path.length).toBeLessThanOrEqual(challenge.budget)
      const end = path.reduce((v, U) => applyUnitary(v, U), challenge.start ?? KET.zero)
      expect(fidelity(end, challenge.target)).toBeGreaterThan(0.9999)
    })
  }
})

describe('rabi drive', () => {
  const close = (a, b) => {
    expect(a.x).toBeCloseTo(b.x, 6)
    expect(a.y).toBeCloseTo(b.y, 6)
    expect(a.z).toBeCloseTo(b.z, 6)
  }

  it('flips |0⟩ to |1⟩ with an on-resonance π-pulse', () => {
    close(drive(KET.zero, { rabi: 10, detuning: 0, phase: 0 }, 50), KET.one)
  })

  it('a φ = 0 drive is an Rx rotation', () => {
    const d = { rabi: 5, detuning: 0, phase: 0 }
    close(applyUnitary(KET.zero, driveUnitary(d, 50)), applyUnitary(KET.zero, rx(Math.PI / 2)))
  })

  it('a φ = 90° drive is an Ry rotation', () => {
    const d = { rabi: 5, detuning: 0, phase: Math.PI / 2 }
    close(applyUnitary(KET.zero, driveUnitary(d, 50)), applyUnitary(KET.zero, ry(Math.PI / 2)))
  })

  it('unitary and closed-form paths agree for a detuned drive', () => {
    const d = { rabi: 7, detuning: 3, phase: 0.4 }
    const v = { x: 0.3, y: -0.5, z: 0.81 }
    close(applyUnitary(v, driveUnitary(d, 37)), drive(v, d, 37))
  })

  it('detuning caps the population transfer at Ω²/(Ω² + Δ²)', () => {
    const d = { rabi: 4, detuning: 3, phase: 0 }
    // Half a period at Ω_eff = 5 MHz is 100 ns: the point of maximum transfer.
    const p1 = (1 - drive(KET.zero, d, 100).z) / 2
    expect(p1).toBeCloseTo(16 / 25, 6)
  })

  it('pure detuning only precesses about z', () => {
    const v = drive(KET.plus, { rabi: 0, detuning: 2.5, phase: 0 }, 100)
    close(v, KET.plusI)
  })
})

describe('library tracks', () => {
  it('every entry declares a track that exists', () => {
    for (const a of ALGORITHMS) expect(TRACK_ORDER).toContain(a.track)
  })

  it('the two tracks partition the library with nothing lost or duplicated', () => {
    expect(PROTOCOLS.length + PURE_ALGORITHMS.length).toBe(ALGORITHMS.length)
    const ids = [...PROTOCOLS, ...PURE_ALGORITHMS].map((a) => a.id)
    expect(new Set(ids).size).toBe(ALGORITHMS.length)
  })

  it('puts the entanglement protocols on one side and the computations on the other', () => {
    expect(PROTOCOLS.map((a) => a.id)).toEqual(['bell', 'teleportation', 'superdense'])
    expect(PURE_ALGORITHMS.map((a) => a.id)).toEqual(['deutsch-jozsa', 'bernstein-vazirani', 'grover', 'qft', 'qpe'])
  })

  it('every track is non-empty, so neither card opens onto nothing', () => {
    for (const id of TRACK_ORDER) expect(TRACKS[id].items.length).toBeGreaterThan(0)
  })

  it('protocols carry the fields their panels render', () => {
    for (const p of PROTOCOLS) {
      expect(p.delivers).toBeTruthy()
      expect(p.cost.note).toBeTruthy()
      expect(p.parties.length).toBeGreaterThan(0)
      // Every party must name a real qubit in the built circuit, or the
      // "who holds what" list and the spheres below it disagree.
      const labels = p.build(defaultParams(p)).labels
      for (const party of p.parties) expect(labels).toContain(party.qubit)
    }
  })

  it('teleportation spends an ebit and two classical bits, sending no qubit', () => {
    const t = PROTOCOLS.find((a) => a.id === 'teleportation')
    expect(t.cost).toMatchObject({ ebits: 1, qubitsSent: 0, classicalBits: 2 })
  })

  it('superdense sends one qubit and no classical bits', () => {
    const s = PROTOCOLS.find((a) => a.id === 'superdense')
    expect(s.cost).toMatchObject({ ebits: 1, qubitsSent: 1, classicalBits: 0 })
  })

  it('only algorithms advertise a query advantage', () => {
    for (const p of PROTOCOLS) expect(p.queries).toBeUndefined()
    for (const a of PURE_ALGORITHMS) expect(a.cost).toBeUndefined()
  })
})
