import amplitudeAmplification from './amplitudeAmplification'
import b92 from './b92'
import bb84 from './bb84'
import bell from './bell'
import bernsteinVazirani from './bernsteinVazirani'
import bosonSampling from './bosonSampling'
import clockSync from './clockSync'
import coinFlipping from './coinFlipping'
import cvQkd from './cvQkd'
import decoyState from './decoyState'
import deutschJozsa from './deutschJozsa'
import e91 from './e91'
import elementDistinctness from './elementDistinctness'
import entanglementSwapping from './entanglementSwapping'
import grover from './grover'
import hamiltonianSimulation from './hamiltonianSimulation'
import hhl from './hhl'
import mdiQkd from './mdiQkd'
import phaseEstimation from './phaseEstimation'
import qaoa from './qaoa'
import qft from './qft'
import qpca from './qpca'
import qsvm from './qsvm'
import quantumCounting from './quantumCounting'
import quantumWalk from './quantumWalk'
import randomizedBenchmarking from './randomizedBenchmarking'
import secretSharing from './secretSharing'
import shor from './shor'
import shorCode from './shorCode'
import shorDlog from './shorDlog'
import simon from './simon'
import steaneCode from './steaneCode'
import superdense from './superdense'
import surfaceCode from './surfaceCode'
import teleportation from './teleportation'
import tfQkd from './tfQkd'
import tomography from './tomography'
import triangleFinding from './triangleFinding'
import vqe from './vqe'
import wiesnerMoney from './wiesnerMoney'

/**
 * The library: every algorithm and protocol from the course directory, plus
 * Bell state as the foundation the communication protocols build on.
 *
 * Adding an entry is one file. Every entry has
 *   { id, track, group, name, level, category, speedup, summary, analogy,
 *     keyIdea, limits?, dir, flow, lab?, params, build? }
 * - `dir` holds the directory's three columns (algorithms: problem /
 *   advantage / mechanism; protocols: domain / function / resource).
 * - `flow` is the step-by-step flowchart: [{ lane, title, text, kind, via?, loop? }].
 * - `lab` names an interactive simulation in ../labs.
 * - `build(params)` (optional) returns a circuit for the step-through
 *   debugger: { qubits, labels, readout, steps, answer, target? }.
 * Protocols may also carry `delivers`, `parties` and `cost`.
 *
 * `track` splits the library, because the halves are judged differently:
 * - protocol: parties achieving a task with quantum resources -- moving or
 *   protecting information, or characterising hardware. Measured in
 *   resources spent and security or fidelity gained.
 * - algorithm: computing an answer in fewer steps than any classical method.
 *   Measured in queries, gates or scaling.
 */

const ALGORITHM_ORDER = [
  // oracle problems
  deutschJozsa,
  bernsteinVazirani,
  simon,
  // Fourier & phase
  qft,
  phaseEstimation,
  shor,
  shorDlog,
  // search & amplitude
  grover,
  amplitudeAmplification,
  quantumCounting,
  // quantum walks
  quantumWalk,
  elementDistinctness,
  triangleFinding,
  // linear algebra & machine learning
  hhl,
  qsvm,
  qpca,
  // variational
  vqe,
  qaoa,
  // simulation & sampling
  hamiltonianSimulation,
  bosonSampling,
]

const PROTOCOL_ORDER = [
  bell,
  teleportation,
  superdense,
  entanglementSwapping,
  bb84,
  e91,
  b92,
  decoyState,
  mdiQkd,
  tfQkd,
  cvQkd,
  secretSharing,
  coinFlipping,
  wiesnerMoney,
  shorCode,
  steaneCode,
  surfaceCode,
  tomography,
  randomizedBenchmarking,
  clockSync,
]

export const ALGORITHMS = [...PROTOCOL_ORDER, ...ALGORITHM_ORDER]
export const PROTOCOLS = PROTOCOL_ORDER
export const PURE_ALGORITHMS = ALGORITHM_ORDER

export const GROUPS = {
  algorithm: [
    { id: 'oracle', label: 'Oracle problems' },
    { id: 'fourier', label: 'Fourier & phase' },
    { id: 'search', label: 'Search & amplitude' },
    { id: 'walks', label: 'Quantum walks' },
    { id: 'linalg', label: 'Linear algebra & ML' },
    { id: 'variational', label: 'Variational (near-term)' },
    { id: 'simulation', label: 'Simulation & sampling' },
  ],
  protocol: [
    { id: 'foundations', label: 'Foundations' },
    { id: 'communication', label: 'Communication & networking' },
    { id: 'qkd', label: 'Key distribution (QKD)' },
    { id: 'crypto', label: 'Cryptography' },
    { id: 'qec', label: 'Error correction' },
    { id: 'characterization', label: 'Characterization & metrology' },
  ],
}

/** The directory table's columns, worded as in the course PDF. */
export const COLUMNS = {
  algorithm: [
    { key: 'problem', label: 'Category / Problem Solved' },
    { key: 'advantage', label: 'Advantage' },
    { key: 'mechanism', label: 'Underlying Mechanism' },
  ],
  protocol: [
    { key: 'domain', label: 'Domain' },
    { key: 'function', label: 'Function' },
    { key: 'resource', label: 'Primary Resource' },
  ],
}

export const TRACKS = {
  protocol: {
    id: 'protocol',
    label: 'Protocols',
    tagline: 'Parties, channels and resources',
    blurb:
      'Rules for moving, protecting and checking quantum information: key distribution, teleportation, cryptography, error correction and hardware characterisation. Success is measured in security, fidelity and resources spent.',
    teaches: ['How eavesdropping becomes detectable', 'How entanglement is spent to move information', 'How errors are found and undone'],
    items: PROTOCOLS,
  },
  algorithm: {
    id: 'algorithm',
    label: 'Algorithms',
    tagline: 'Computing answers in fewer steps',
    blurb:
      'Procedures that reach an answer faster than the best known classical method — exponentially (Shor, HHL) or polynomially (Grover, walks) — plus the near-term variational heuristics.',
    teaches: ['How interference cancels wrong answers', 'Why the QFT and phase estimation sit inside Shor', 'Where the speed-ups are real, and where they are fine print'],
    items: PURE_ALGORITHMS,
  },
}

export const TRACK_ORDER = ['protocol', 'algorithm']

export const defaultParams = (algorithm) => Object.fromEntries(algorithm.params.map((p) => [p.key, p.default]))
