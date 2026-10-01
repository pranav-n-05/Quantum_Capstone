import { range } from '../numeric'

const popcount = (x) => {
  let c = 0
  while (x) {
    c += x & 1
    x >>= 1
  }
  return c
}
const parity = (x) => popcount(x) & 1
const maskOf = (qs) => qs.reduce((m, q) => m | (1 << q), 0)

/**
 * Stabilizer codes as bit masks. An X-type error pattern e (bit q = X on
 * data qubit q) trips Z-type stabilizer s when |e ∧ s| is odd; Z errors and
 * X stabilizers likewise. That is all the simulation needs: the codes below
 * are exact for Pauli errors, with no statevector.
 */

function buildDecoder(stabs, nData) {
  const table = new Map()
  for (let e = 0; e < 1 << nData; e++) {
    const key = stabs.map((s) => parity(e & s)).join('')
    const best = table.get(key)
    if (best === undefined || popcount(e) < popcount(best)) table.set(key, e)
  }
  return table
}

function makeCode({ name, nData, xStabs, zStabs, logicalX, logicalZ, layout }) {
  const X = xStabs.map(maskOf)
  const Z = zStabs.map(maskOf)
  const LX = maskOf(logicalX)
  const LZ = maskOf(logicalZ)
  const decodeX = buildDecoder(Z, nData) // X errors seen by Z checks
  const decodeZ = buildDecoder(X, nData)
  const syndrome = (err, stabs) => stabs.map((s) => parity(err & s))

  function decode(errX, errZ) {
    const sx = syndrome(errX, Z)
    const sz = syndrome(errZ, X)
    const corrX = decodeX.get(sx.join(''))
    const corrZ = decodeZ.get(sz.join(''))
    const resX = errX ^ corrX
    const resZ = errZ ^ corrZ
    return {
      zSyndrome: sx,
      xSyndrome: sz,
      corrX,
      corrZ,
      logicalXError: parity(resX & LZ) === 1, // residual X anticommutes with Z_L
      logicalZError: parity(resZ & LX) === 1,
    }
  }

  /** Exact logical failure rate under independent X flips of probability p. */
  function logicalRate(p) {
    let fail = 0
    for (let e = 0; e < 1 << nData; e++) {
      if (decode(e, 0).logicalXError) fail += p ** popcount(e) * (1 - p) ** (nData - popcount(e))
    }
    return fail
  }

  return { name, nData, xStabs, zStabs, X, Z, LX, LZ, logicalX, logicalZ, layout, syndrome, decode, logicalRate }
}

/**
 * Distance-3 rotated surface code: 9 data qubits on a 3×3 grid (q = 3r + c),
 * four weight-4 plaquettes inside and four weight-2 checks on the boundary.
 */
export const SURFACE = makeCode({
  name: 'surface-3',
  nData: 9,
  xStabs: [
    [0, 1, 3, 4],
    [4, 5, 7, 8],
    [1, 2],
    [6, 7],
  ],
  zStabs: [
    [1, 2, 4, 5],
    [3, 4, 6, 7],
    [0, 3],
    [5, 8],
  ],
  // X_L runs down the left column (it commutes with every Z check), Z_L along
  // the top row; they overlap on one qubit, so they anticommute as they must.
  logicalX: [0, 3, 6],
  logicalZ: [0, 1, 2],
  layout: {
    // plaquette centres in grid units (data qubit (r, c) sits at (c, r))
    x: [
      { qubits: [0, 1, 3, 4], at: [0.5, 0.5] },
      { qubits: [4, 5, 7, 8], at: [1.5, 1.5] },
      { qubits: [1, 2], at: [1.5, -0.45] },
      { qubits: [6, 7], at: [0.5, 2.45] },
    ],
    z: [
      { qubits: [1, 2, 4, 5], at: [1.5, 0.5] },
      { qubits: [3, 4, 6, 7], at: [0.5, 1.5] },
      { qubits: [0, 3], at: [-0.45, 0.5] },
      { qubits: [5, 8], at: [2.45, 1.5] },
    ],
  },
})

/**
 * Steane [[7,1,3]]: both stabilizer types are the rows of the Hamming(7,4)
 * check matrix. Column j of that matrix is j+1 in binary, so a single error
 * on qubit j produces syndrome j+1 -- the syndrome *is* the address.
 */
const HAMMING = [
  [3, 4, 5, 6],
  [1, 2, 5, 6],
  [0, 2, 4, 6],
]

export const STEANE = makeCode({
  name: 'steane',
  nData: 7,
  xStabs: HAMMING,
  zStabs: HAMMING,
  logicalX: range(7),
  logicalZ: range(7),
})

/** The qubit a Steane syndrome points at (0 = none). */
export const steaneAddress = (syn) => syn[0] * 4 + syn[1] * 2 + syn[2]

export { popcount, maskOf, parity }
