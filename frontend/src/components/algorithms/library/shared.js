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
