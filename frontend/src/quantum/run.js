import { applyOps, bitstring, probabilities, zeroState } from './statevector'

/**
 * Every intermediate state of a stepped circuit: `states[0]` is |0…0⟩ and
 * `states[k]` is the state after step k. The debugger scrubs through this
 * array, so stepping backwards costs nothing.
 */
export function runSteps(qubits, steps) {
  const states = [zeroState(qubits)]
  for (const step of steps) states.push(applyOps(states[states.length - 1], step.gates))
  return states
}

/**
 * Probability of each bitstring on the `readout` qubits, other qubits summed
 * out. Keys are written most-significant readout qubit first.
 */
export function marginal(state, readout) {
  const probs = probabilities(state)
  const out = {}
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] < 1e-12) continue
    const key = [...readout]
      .reverse()
      .map((q) => ((i >> q) & 1 ? '1' : '0'))
      .join('')
    out[key] = (out[key] ?? 0) + probs[i]
  }
  return out
}

export { bitstring }
