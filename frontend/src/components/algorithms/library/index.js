import bell from './bell'
import teleportation from './teleportation'
import superdense from './superdense'
import deutschJozsa from './deutschJozsa'
import bernsteinVazirani from './bernsteinVazirani'
import grover from './grover'
import qft from './qft'
import phaseEstimation from './phaseEstimation'

/**
 * The algorithm library, in teaching order.
 *
 * Adding an algorithm is one file: export `{ id, name, level, category,
 * speedup, summary, analogy, queries?, params, build(params) }`, where build
 * returns `{ qubits, labels, readout, steps, answer }` and each step is
 * `{ title, gates, narration, math? }`. Then list it here.
 */
export const ALGORITHMS = [
  bell,
  teleportation,
  superdense,
  deutschJozsa,
  bernsteinVazirani,
  grover,
  qft,
  phaseEstimation,
]

export const defaultParams = (algorithm) =>
  Object.fromEntries(algorithm.params.map((p) => [p.key, p.default]))
