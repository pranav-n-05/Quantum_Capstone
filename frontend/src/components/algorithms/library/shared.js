/**
 * Circuit-building helpers shared by the algorithm scripts.
 *
 * Qubit 0 is the least-significant bit (Qiskit order), so a bitstring such as
 * "101" means q2=1, q1=0, q0=1.
 */

export const range = (n) => Array.from({ length: n }, (_, i) => i)

export const gate = (g, t, extra = {}) => ({ g, t: [t], ...extra })
export const cx = (control, target) => ({ g: 'cx', c: [control], t: [target] })
export const cz = (controls, target) => ({ g: 'cz', c: controls, t: [target] })
export const cp = (angle, control, target) => ({ g: 'cp', c: [control], t: [target], angle })

export const onEach = (g, qubits) => qubits.map((q) => gate(g, q))

/** Bit `q` of a bitstring written most-significant qubit first. */
export const bitOf = (bits, q) => bits[bits.length - 1 - q] === '1'

/** X gates that turn |0…0⟩ into the basis state `bits`. */
export const prepareBits = (bits) =>
  range(bits.length)
    .filter((q) => bitOf(bits, q))
    .map((q) => gate('x', q))

export const toBits = (value, n) => value.toString(2).padStart(n, '0')

/**
 * Quantum Fourier transform on `qubits`, as Qiskit builds it: for each qubit
 * from the top down, a Hadamard then controlled phases from every lower
 * qubit; finally swaps to undo the bit reversal. Returned as stages so the
 * debugger can step through them one qubit at a time.
 */
export function qftStages(qubits) {
  const n = qubits.length
  const stages = []
  for (let j = n - 1; j >= 0; j--) {
    const ops = [gate('h', qubits[j])]
    for (let k = j - 1; k >= 0; k--) ops.push(cp(Math.PI / 2 ** (j - k), qubits[k], qubits[j]))
    stages.push({ qubit: qubits[j], ops })
  }
  const swaps = []
  for (let i = 0; i < Math.floor(n / 2); i++) swaps.push({ g: 'swap', t: [qubits[i], qubits[n - 1 - i]] })
  return { stages, swaps }
}

/** Inverse of a list of ops made of H, controlled phases and swaps. */
export const inverse = (ops) =>
  [...ops].reverse().map((op) => (op.angle === undefined ? op : { ...op, angle: -op.angle }))

export const DEG = Math.PI / 180

/**
 * Flip the sign of one basis state of `qubits` (listed least-significant
 * first; `bits` written most-significant first, like toBits). One multi-
 * controlled Z with negative controls where the pattern has a 0.
 */
export function markState(bits, qubits) {
  const target = qubits[qubits.length - 1]
  const others = qubits.slice(0, -1)
  const c = others.filter((q, i) => bits[bits.length - 1 - i] === '1')
  const nc = others.filter((q, i) => bits[bits.length - 1 - i] === '0')
  const z = { g: 'z', t: [target], ...(c.length ? { c } : {}), ...(nc.length ? { nc } : {}) }
  return bits[0] === '1' ? [z] : [gate('x', target), z, gate('x', target)]
}

/** Grover's diffusion 2|s⟩⟨s| − I on `qubits` (global sign kept textbook). */
export function diffusionOps(qubits) {
  const top = qubits[qubits.length - 1]
  const rest = qubits.slice(0, -1)
  return [
    ...onEach('h', qubits),
    ...onEach('x', qubits),
    { g: 'z', t: [top], c: rest },
    ...onEach('x', qubits),
    ...onEach('h', qubits),
    { g: 'gphase', t: [], angle: Math.PI },
  ]
}

/** Controlled-SWAP from three Toffolis. */
export const cswap = (control, a, b) => [cx(b, a), { g: 'cx', c: [control, a], t: [b] }, cx(b, a)]

/** |v⟩ → |a·v mod N⟩ on a register of `bits` qubits (values ≥ N left alone). */
export const mulModMap = (a, N, bits) => range(2 ** bits).map((v) => (v < N ? (a * v) % N : v))

/** Add a control qubit to every op (global phases become phase gates on it). */
export const controlled = (ops, control) =>
  ops.map((op) =>
    op.g === 'gphase' ? { g: 'p', t: [control], angle: op.angle } : { ...op, c: [...(op.c ?? []), control] },
  )

export const ry = (angle, q) => ({ g: 'ry', t: [q], angle })
export const rz = (angle, q) => ({ g: 'rz', t: [q], angle })
export const rx = (angle, q) => ({ g: 'rx', t: [q], angle })
export const mat = (m, q, extra = {}) => ({ g: 'mat', t: [q], m, ...extra })

/** Inverse QFT ops on `qubits`, ready to drop into a step. */
export function inverseQft(qubits) {
  const { stages, swaps } = qftStages(qubits)
  return inverse([...stages.flatMap((s) => s.ops), ...swaps])
}

export function forwardQft(qubits) {
  const { stages, swaps } = qftStages(qubits)
  return [...stages.flatMap((s) => s.ops), ...swaps]
}
