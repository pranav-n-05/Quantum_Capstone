import { applyOp, zeroState } from './statevector'

/**
 * Pauli strings, written most-significant qubit first like Qiskit:
 * 'XZ' means X on q1 and Z on q0.
 */

function applyPauli(state, str) {
  const n = str.length
  let s = state
  for (let k = 0; k < n; k++) {
    const ch = str[k]
    if (ch !== 'I') s = applyOp(s, { g: ch.toLowerCase(), t: [n - 1 - k] })
  }
  return s
}

/** ⟨ψ|P|ψ⟩ for a Pauli string P (always real). */
export function expectPauli(state, str) {
  const s = applyPauli(state, str)
  let re = 0
  for (let i = 0; i < s.re.length; i++) re += state.re[i] * s.re[i] + state.im[i] * s.im[i]
  return re
}

/** ⟨H⟩ for H = Σ cₖ Pₖ given as [[c, 'PAULI'], …]. */
export const expectHamiltonian = (state, terms) => terms.reduce((e, [coef, str]) => e + coef * expectPauli(state, str), 0)

/** Dense matrix of a Hamiltonian with only I/X/Z factors (so it is real). */
export function hamiltonianMatrix(terms, n) {
  const dim = 1 << n
  const M = Array.from({ length: dim }, () => new Array(dim).fill(0))
  for (let j = 0; j < dim; j++) {
    const basis = zeroState(n)
    basis.re[0] = 0
    basis.re[j] = 1
    for (const [coef, str] of terms) {
      const out = applyPauli(basis, str)
      for (let i = 0; i < dim; i++) M[i][j] += coef * out.re[i]
    }
  }
  return M
}
