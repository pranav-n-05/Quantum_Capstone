import { cx, gate } from './shared'

const NOTE = 0
const PROBE = 1
const STATES = { Z0: '|0⟩', Z1: '|1⟩', X0: '|+⟩', X1: '|−⟩' }

export default {
  id: 'wiesner-money',
  track: 'protocol',
  group: 'crypto',
  dir: { domain: 'Cryptography', function: 'Creating physically unforgeable bank notes', resource: 'No-cloning theorem, non-orthogonal bases' },
  name: "Wiesner's Quantum Money",
  level: 'Beginner',
  category: 'Cryptography',
  speedup: 'Forgery fails exponentially',
  summary: 'A bank note carries qubits in secret BB84 states recorded by the bank. A counterfeiter cannot copy unknown states, and any attempt passes verification only (3/4)ⁿ of the time.',
  delivers: 'Money whose security rests on physics, not secrecy of a printing technique (Wiesner, ~1970 — the first quantum-cryptography idea).',
  parties: [
    { qubit: 'note', who: 'Bank', role: 'one of the note’s secret qubits' },
    { qubit: 'probe', who: 'Forger', role: 'records the forger’s measurement' },
  ],
  analogy:
    'A banknote with tiny compass needles, each secretly set north–south or east–west. Reading a needle with the wrong compass spins it randomly. A forger must read them to copy them — and spins about a quarter of them wrong.',
  keyIdea:
    'The no-cloning theorem forbids copying an unknown quantum state. The best a forger can do per qubit is pass with probability 3/4 (proved optimal by Molina, Vidick & Watrous 2012), so a note with n qubits is forged successfully only (3/4)ⁿ of the time.',
  limits: 'Needs long-lived quantum memories in every note, and only the bank can verify (private-key money). Public-key quantum money remains a research problem.',
  lab: 'wiesner-money',
  lanes: ['Bank', 'Forger'],
  flow: [
    { lane: 'Bank', title: 'Print note: serial + n secret states', text: 'Bank records each (basis, bit).', kind: 'quantum' },
    { lane: 'Forger', title: 'Try to copy', text: 'Measure in a guessed basis, re-prepare.', kind: 'measure', via: 'quantum' },
    { lane: 'Bank', title: 'Verify', text: 'Measure each qubit in its recorded basis.', kind: 'measure', via: 'quantum' },
    { lane: 'Bank', title: 'All n match?', text: 'Pass ⇒ accept; any mismatch ⇒ forgery.', kind: 'decision' },
  ],
  params: [
    { key: 'state', label: 'Bank’s secret state', options: Object.entries(STATES).map(([value, label]) => ({ value, label })), default: 'X1' },
    { key: 'forger', label: 'Forger measures in', options: [{ value: 'none', label: 'does nothing' }, { value: 'Z', label: 'Z' }, { value: 'X', label: 'X' }], default: 'Z' },
  ],
  build({ state, forger }) {
    const basis = state[0]
    const bit = state[1]
    const toBasis = (b) => (b === 'X' ? [gate('h', NOTE)] : [])
    const pPass = forger === 'none' || forger === basis ? 1 : 0.5
    return {
      qubits: forger === 'none' ? 1 : 2,
      labels: forger === 'none' ? ['note'] : ['note', 'probe'],
      readout: [NOTE],
      steps: [
        { title: `Bank prints ${STATES[state]}`, gates: [...(bit === '1' ? [gate('x', NOTE)] : []), ...toBasis(basis)], narration: 'Only the bank knows which of the four states this qubit is in.' },
        ...(forger === 'none'
          ? []
          : [
              {
                title: `Forger measures in ${forger}`,
                gates: [...toBasis(forger), cx(NOTE, PROBE), ...toBasis(forger)],
                narration:
                  forger === basis
                    ? 'Lucky guess: the forger learns the bit without disturbing it.'
                    : 'Wrong basis: the measurement scrambles the qubit — its arrow collapses toward the centre.',
              },
            ]),
        { title: 'Bank verifies', gates: toBasis(basis), narration: `The bank measures in the recorded basis (${basis}) and expects ${bit}. Pass probability: ${(pPass * 100).toFixed(0)}%.` },
      ],
      answer: { text: `Passes with ${(pPass * 100).toFixed(0)}% (averaged over guesses: 75% per qubit).`, check: (d) => Math.abs((d[bit] ?? 0) - pPass) < 1e-9 },
    }
  },
}
