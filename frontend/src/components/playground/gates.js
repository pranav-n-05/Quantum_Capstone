/**
 * The gate vocabulary, mirroring backend/models.py GateKind.
 *
 * The backend validates every circuit regardless of what this file says -- this
 * exists so the UI can label, colour and lay out gates, not to enforce anything.
 * If the two ever disagree the backend wins and the user sees a 422.
 */

/** Two-qubit gates are ordered [control, target]. */
export const GATES = [
  { kind: 'h', label: 'H', arity: 1, title: 'Hadamard — creates superposition' },
  { kind: 'x', label: 'X', arity: 1, title: 'Pauli-X — bit flip' },
  { kind: 'y', label: 'Y', arity: 1, title: 'Pauli-Y' },
  { kind: 'z', label: 'Z', arity: 1, title: 'Pauli-Z — phase flip' },
  { kind: 's', label: 'S', arity: 1, title: 'S — quarter turn about Z' },
  { kind: 'sdg', label: 'S†', arity: 1, title: 'S-dagger — inverse of S' },
  { kind: 't', label: 'T', arity: 1, title: 'T — eighth turn about Z' },
  { kind: 'tdg', label: 'T†', arity: 1, title: 'T-dagger — inverse of T' },
  { kind: 'rx', label: 'RX', arity: 1, parameterised: true, title: 'Rotation about X' },
  { kind: 'ry', label: 'RY', arity: 1, parameterised: true, title: 'Rotation about Y' },
  { kind: 'rz', label: 'RZ', arity: 1, parameterised: true, title: 'Rotation about Z' },
  { kind: 'cx', label: 'CX', arity: 2, title: 'Controlled-NOT — entangles two qubits' },
  { kind: 'cz', label: 'CZ', arity: 2, title: 'Controlled-Z' },
  { kind: 'swap', label: 'SWAP', arity: 2, title: 'Exchange two qubits' },
]

export const GATE_BY_KIND = Object.fromEntries(GATES.map((gate) => [gate.kind, gate]))

/** Common angles, so the usual cases need no typing. */
export const ANGLE_PRESETS = [
  { label: 'π/8', value: Math.PI / 8 },
  { label: 'π/4', value: Math.PI / 4 },
  { label: 'π/2', value: Math.PI / 2 },
  { label: 'π', value: Math.PI },
]

/** Render an angle as a multiple of π where that is exact enough to be useful. */
export function formatAngle(radians) {
  if (radians === 0) return '0'
  const ratio = radians / Math.PI
  for (const denominator of [1, 2, 3, 4, 6, 8]) {
    const scaled = ratio * denominator
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) {
      const numerator = Math.round(scaled)
      if (denominator === 1) return numerator === 1 ? 'π' : numerator === -1 ? '−π' : `${numerator}π`
      const sign = numerator < 0 ? '−' : ''
      const magnitude = Math.abs(numerator)
      return `${sign}${magnitude === 1 ? '' : magnitude}π/${denominator}`
    }
  }
  return radians.toFixed(2)
}

/** A short human description of one op, for tooltips. */
export function describeOp(op) {
  const gate = GATE_BY_KIND[op.kind]
  const name = gate?.label ?? op.kind
  const angle = op.parameter != null ? `(${formatAngle(op.parameter)})` : ''
  if (gate?.arity === 2) {
    return `${name} control q${op.qubits[0]} → target q${op.qubits[1]}`
  }
  return `${name}${angle} on q${op.qubits[0]}`
}
