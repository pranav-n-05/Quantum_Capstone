import bell from './bell'
import teleportation from './teleportation'
import superdense from './superdense'
import deutschJozsa from './deutschJozsa'
import bernsteinVazirani from './bernsteinVazirani'
import grover from './grover'
import qft from './qft'
import phaseEstimation from './phaseEstimation'

/**
 * The library, in teaching order.
 *
 * Adding an entry is one file: export `{ id, name, track, level, category,
 * speedup, summary, analogy, queries?, params, build(params) }`, where build
 * returns `{ qubits, labels, readout, steps, answer }` and each step is
 * `{ title, gates, narration, math? }`. Then list it here.
 *
 * `track` splits the library in two, because the two halves answer different
 * questions and are judged by different yardsticks:
 *
 * - **protocol** — two parties, separated by distance, achieving something
 *   with entanglement that classical post could not. Measured in resources
 *   spent: ebits, qubits sent, classical bits phoned over. A protocol file
 *   also carries `delivers`, `parties` and `cost`.
 * - **algorithm** — one party, computing an answer about its own input in
 *   fewer steps than any classical method. Measured in queries or gate count,
 *   via the optional `queries` field.
 *
 * Bell state sits in protocols rather than algorithms: it computes nothing,
 * and its entire purpose is to manufacture the ebit the other two spend.
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

export const PROTOCOLS = ALGORITHMS.filter((a) => a.track === 'protocol')
export const PURE_ALGORITHMS = ALGORITHMS.filter((a) => a.track === 'algorithm')

/**
 * The two tracks, as the chooser and the rail present them. `blurb` is the
 * one-line distinction; `teaches` is what the reader walks away able to say.
 */
export const TRACKS = {
  protocol: {
    id: 'protocol',
    label: 'Protocols',
    tagline: 'Two parties, one shared resource',
    blurb:
      'Entanglement used as a communication resource. Nobody is computing an answer here — Alice and Bob are moving information between two places in ways ordinary post cannot.',
    teaches: ['What an ebit is and how it is spent', 'Why teleportation sends no information faster than light', 'How one qubit can carry two bits'],
    items: PROTOCOLS,
  },
  algorithm: {
    id: 'algorithm',
    label: 'Algorithms',
    tagline: 'One party, fewer steps',
    blurb:
      'Computations that reach an answer in fewer queries than any classical method. Interference is the engine: wrong answers cancel, the right one survives.',
    teaches: ['How a phase oracle marks an answer without revealing it', 'Why amplitude amplification needs √N rounds', 'How the QFT turns a period into a readable number'],
    items: PURE_ALGORITHMS,
  },
}

export const TRACK_ORDER = ['protocol', 'algorithm']

export const defaultParams = (algorithm) =>
  Object.fromEntries(algorithm.params.map((p) => [p.key, p.default]))
