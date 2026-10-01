import { range } from '../numeric'

/**
 * Discrete-time Hadamard walk on a line. Amplitudes live on (position, coin);
 * each step applies H to the coin, then moves coin-1 right and coin-0 left.
 * Starting coin (|0⟩ + i|1⟩)/√2 gives the symmetric two-horned distribution.
 */
export function hadamardWalk(T, start = 'symmetric') {
  const size = 2 * T + 1
  let re = [new Float64Array(size), new Float64Array(size)]
  let im = [new Float64Array(size), new Float64Array(size)]
  const S = Math.SQRT1_2
  if (start === 'symmetric') {
    re[0][T] = S
    im[1][T] = S
  } else {
    re[0][T] = 1
  }
  for (let step = 0; step < T; step++) {
    const nre = [new Float64Array(size), new Float64Array(size)]
    const nim = [new Float64Array(size), new Float64Array(size)]
    for (let x = 0; x < size; x++) {
      const a0r = re[0][x], a0i = im[0][x], a1r = re[1][x], a1i = im[1][x]
      // coin: H
      const c0r = S * (a0r + a1r), c0i = S * (a0i + a1i)
      const c1r = S * (a0r - a1r), c1i = S * (a0i - a1i)
      // shift: coin 0 → left, coin 1 → right
      if (x - 1 >= 0) {
        nre[0][x - 1] += c0r
        nim[0][x - 1] += c0i
      }
      if (x + 1 < size) {
        nre[1][x + 1] += c1r
        nim[1][x + 1] += c1i
      }
    }
    re = nre
    im = nim
  }
  const probs = range(size).map((x) => re[0][x] ** 2 + im[0][x] ** 2 + re[1][x] ** 2 + im[1][x] ** 2)
  return { positions: range(size).map((x) => x - T), probs }
}

/** Classical ±1 random walk after T steps (binomial, odd/even sites only). */
export function classicalWalk(T) {
  const size = 2 * T + 1
  const probs = new Array(size).fill(0)
  let logC = 0 // log C(T, k)
  for (let k = 0; k <= T; k++) {
    if (k > 0) logC += Math.log(T - k + 1) - Math.log(k)
    probs[2 * k] = Math.exp(logC - T * Math.LN2) // k right-steps → position 2k − T
  }
  return { positions: range(size).map((x) => x - T), probs }
}

export function spread({ positions, probs }) {
  const mean = positions.reduce((s, x, i) => s + x * probs[i], 0)
  const varx = positions.reduce((s, x, i) => s + (x - mean) ** 2 * probs[i], 0)
  return Math.sqrt(varx)
}
