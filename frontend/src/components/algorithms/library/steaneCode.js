import { cx, gate, onEach, range } from './shared'

const DATA = range(7)
const ANC = [7, 8, 9]
const ROWS = [
  [3, 4, 5, 6],
  [1, 2, 5, 6],
  [0, 2, 4, 6],
] // Hamming check rows; ancilla k measures row k
const PIVOT = [3, 1, 0]

/** Is bitstring (MSB = q9 … q0) a data pattern from the right codeword class? */
const weight = (key) => key.slice(3).split('').filter((c) => c === '1').length

export default {
  id: 'steane-code',
  track: 'protocol',
  group: 'qec',
  dir: { domain: 'Error Correction', function: 'CSS code for fault tolerance', resource: 'Transversal logic gates' },
  name: 'Steane Code (7-qubit)',
  level: 'Advanced',
  category: 'Error correction',
  speedup: 'Syndrome = error address',
  summary: 'Seven qubits built from the classical Hamming code. Three parity checks pinpoint any single error — the syndrome, read as a binary number, *is* the faulty qubit’s position.',
  delivers: 'One protected qubit with logical H, S and CNOT done "transversally" — gate by gate on all seven, which keeps errors from spreading.',
  analogy:
    'Seven lamps wired so that three checking circuits each watch four lamps. If one lamp fails, the pattern of alarms spells its number in binary — 101 means lamp 5.',
  keyIdea:
    'CSS construction: use the Hamming [7,4,3] code’s checks both as Z-type stabilizers (catching X errors) and X-type stabilizers (catching Z errors). Because the code contains its own dual, Hadamard on all 7 qubits is the logical Hadamard — the property that made it the classic fault-tolerance example.',
  limits: 'The circuit corrects X errors on |0_L⟩ / |1_L⟩ with 3 ancillas (10 qubits); Z errors are symmetric and shown in the Lab. Two errors cause a logical failure (distance 3).',
  lab: 'steane-code',
  lanes: ['Encoder', 'Noise', 'Checker'],
  flow: [
    { lane: 'Encoder', title: 'Encode |0_L⟩', text: 'Superposition of the 8 even Hamming codewords.', kind: 'quantum' },
    { lane: 'Noise', title: 'Error on one qubit', text: '', kind: 'quantum', via: 'quantum' },
    { lane: 'Checker', title: '3 parity checks → 3 ancillas', text: 'Syndrome s₂s₁s₀.', kind: 'measure', via: 'quantum' },
    { lane: 'Checker', title: 'Flip qubit number s₂s₁s₀', text: 'Binary address of the error.', kind: 'quantum' },
  ],
  params: [
    { key: 'logical', label: 'Logical state', options: [{ value: '0', label: '|0_L⟩' }, { value: '1', label: '|1_L⟩' }], default: '0' },
    { key: 'error', label: 'X error on', options: [{ value: 'none', label: 'none' }, ...DATA.map((q) => ({ value: String(q), label: `q${q} (address ${q + 1} = ${(q + 1).toString(2).padStart(3, '0')})` }))], default: '4' },
  ],
  build({ logical, error }) {
    const encode = [...onEach('h', PIVOT), ...ROWS.flatMap((row, k) => row.filter((q) => q !== PIVOT[k]).map((q) => cx(PIVOT[k], q)))]
    const correction = DATA.map((j) => {
      const a = j + 1
      const bits = [(a >> 2) & 1, (a >> 1) & 1, a & 1]
      return { g: 'x', t: [j], c: ANC.filter((_, k) => bits[k]), nc: ANC.filter((_, k) => !bits[k]) }
    })
    const odd = logical === '1'
    return {
      qubits: 10,
      labels: [...DATA.map((q) => `d${q}`), 's2', 's1', 's0'],
      readout: [...DATA, ...ANC],
      steps: [
        { title: 'Encode |0_L⟩', gates: encode, narration: 'Hadamards on three pivot qubits, then CNOTs spread each pivot over its check row: an equal superposition of the 8 codewords of even weight.' },
        ...(odd ? [{ title: 'Logical X (transversal)', gates: onEach('x', DATA), narration: 'X on all seven qubits is the logical X: |0_L⟩ → |1_L⟩ (all odd-weight codewords).' }] : []),
        { title: error === 'none' ? 'No error' : `X error on d${error}`, gates: error === 'none' ? [] : [gate('x', Number(error))], narration: error === 'none' ? 'Clean run.' : `A bit flip on d${error}.` },
        {
          title: 'Measure the three checks',
          gates: ROWS.flatMap((row, k) => row.map((q) => cx(q, ANC[k]))),
          narration: error === 'none' ? 'All checks pass: syndrome 000.' : `Syndrome s₂s₁s₀ = ${(Number(error) + 1).toString(2).padStart(3, '0')} = ${Number(error) + 1}: the error is on qubit ${Number(error) + 1} (d${error}).`,
        },
        { title: 'Flip the addressed qubit', gates: correction, narration: 'Seven 3-controlled X gates — only the one whose address matches the syndrome fires. The data are back in the code.' },
      ],
      answer: {
        text: `Every data outcome is a valid ${odd ? 'odd' : 'even'}-weight codeword again.`,
        check: (d) => Object.keys(d).every((k) => weight(k) % 2 === (odd ? 1 : 0) && (weight(k) === 0 || weight(k) === 4 || weight(k) === 3 || weight(k) === 7)),
      },
    }
  },
}
