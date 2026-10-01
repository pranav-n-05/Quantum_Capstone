import { cx, DEG, gate, onEach, range } from './shared'

const INPUTS = {
  zero: { label: '|0⟩', theta: 0, phi: 0 },
  one: { label: '|1⟩', theta: Math.PI, phi: 0 },
  plus: { label: '|+⟩', theta: Math.PI / 2, phi: 0 },
  tilted: { label: 'θ=60°, φ=45°', theta: 60 * DEG, phi: 45 * DEG },
}
const BLOCKS = [0, 3, 6]

const toffoli = (a, b, t) => ({ g: 'cx', c: [a, b], t: [t] })

export default {
  id: 'shor-code',
  track: 'protocol',
  group: 'qec',
  dir: { domain: 'Error Correction', function: 'Protecting against arbitrary single-qubit errors', resource: 'Entanglement, Syndrome measurement' },
  name: 'Shor Code (9-qubit)',
  level: 'Advanced',
  category: 'Error correction',
  speedup: 'Corrects any 1-qubit error',
  summary: 'Spread one qubit over nine: three copies against bit flips, each copy itself in a three-way phase-flip code. Any single X, Y or Z error anywhere is undone.',
  delivers: 'The first proof (Shor 1995) that quantum information can be protected at all.',
  analogy:
    'Saying a word three times so a single mishearing can be outvoted — then doing that whole thing three times in a different "language" so a single mis-pronunciation is outvoted too.',
  keyIdea:
    'Quantum errors seem continuous and copying is forbidden, yet both obstacles fall: a repetition code built from CNOTs spreads (not copies) the state, and measuring parities (syndromes) collapses any error into a discrete X, Z or Y that can be reversed. Correcting X and Z separately corrects everything.',
  limits: 'Decoding here uses Toffoli majority votes instead of measured ancillas (equivalent for one round). 9 qubits per logical qubit and no fault-tolerant gates — surface codes are the practical route.',
  lab: null,
  lanes: ['Encoder', 'Noise', 'Decoder'],
  flow: [
    { lane: 'Encoder', title: 'Phase-flip layer', text: 'CNOT to qubits 3, 6; Hadamard all three.', kind: 'quantum' },
    { lane: 'Encoder', title: 'Bit-flip layer', text: 'Each of 0, 3, 6 spread over its block of three.', kind: 'quantum' },
    { lane: 'Noise', title: 'One X, Y or Z error, anywhere', text: '', kind: 'quantum', via: 'quantum' },
    { lane: 'Decoder', title: 'Majority vote in each block', text: 'Fixes any single bit flip.', kind: 'quantum', via: 'quantum' },
    { lane: 'Decoder', title: 'Majority vote across blocks', text: 'Fixes any single phase flip.', kind: 'quantum' },
    { lane: 'Decoder', title: 'Qubit 0 = original state', text: '', kind: 'quantum' },
  ],
  params: [
    { key: 'input', label: 'Logical state', options: Object.entries(INPUTS).map(([value, i]) => ({ value, label: i.label })), default: 'tilted' },
    { key: 'error', label: 'Error type', options: ['none', 'x', 'z', 'y'].map((value) => ({ value, label: value === 'none' ? 'none' : value.toUpperCase() })), default: 'y' },
    { key: 'where', label: 'On qubit', options: range(9).map((q) => ({ value: String(q), label: `q${q}` })), default: '4' },
  ],
  build({ input, error, where }) {
    const { theta, phi } = INPUTS[input]
    const q = Number(where)
    return {
      qubits: 9,
      labels: range(9).map((i) => `q${i}`),
      readout: [0],
      steps: [
        { title: 'Logical state on q0', gates: [{ g: 'u', t: [0], params: [theta, phi, 0] }], narration: `The state to protect: ${INPUTS[input].label}. Note q0’s arrow — it must come back exactly.` },
        { title: 'Phase-flip encoding', gates: [cx(0, 3), cx(0, 6), ...onEach('h', BLOCKS)], narration: 'Spread across q0, q3, q6, then rotate to the ± basis: a phase flip on one block now looks like a bit flip between blocks.' },
        { title: 'Bit-flip encoding', gates: BLOCKS.flatMap((b) => [cx(b, b + 1), cx(b, b + 2)]), narration: 'Each block leader spreads to its two neighbours. All nine qubits now share the state; every arrow has vanished — no single qubit holds the information.' },
        {
          title: error === 'none' ? 'No error' : `${error.toUpperCase()} error on q${q}`,
          gates: error === 'none' ? [] : [gate(error, q)],
          narration: error === 'none' ? 'A clean run, for comparison.' : `Noise hits q${q} with ${error.toUpperCase()}${error === 'y' ? ' (= a bit flip and a phase flip at once)' : ''}. Watch the amplitude bars change.`,
        },
        {
          title: 'Fix bit flips in each block',
          gates: BLOCKS.flatMap((b) => [cx(b, b + 1), cx(b, b + 2), toffoli(b + 1, b + 2, b)]),
          narration: 'Undo each block’s spreading; if the two helpers both disagree, the Toffoli flips the leader back — a majority vote.',
        },
        {
          title: 'Fix phase flips across blocks',
          gates: [...onEach('h', BLOCKS), cx(0, 3), cx(0, 6), toffoli(3, 6, 0)],
          narration: 'Same majority vote between the three block leaders, in the ± basis. q0 is now back to the original state, whatever single error happened.',
        },
      ],
      answer: { text: 'q0 ends exactly where it started.' },
      target: { qubit: 0, theta, phi },
    }
  },
}
