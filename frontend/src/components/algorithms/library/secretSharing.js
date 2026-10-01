import { GHZ_SIGN } from '../../../quantum/labs/crypto'
import { cx, gate } from './shared'

const basisOps = (b, q) => (b === 'Y' ? [{ g: 'sdg', t: [q] }, gate('h', q)] : [gate('h', q)])

export default {
  id: 'secret-sharing',
  track: 'protocol',
  group: 'crypto',
  dir: { domain: 'Cryptography', function: 'Distributing a secret state among multiple parties', resource: 'GHZ states (Multipartite entanglement)' },
  name: 'Quantum Secret Sharing',
  level: 'Intermediate',
  category: 'Cryptography',
  speedup: 'Needs everyone, leaks to no one',
  summary: 'Alice shares a GHZ state with Bob and Charlie. Her measurement result can be reconstructed only when Bob and Charlie combine theirs — either alone learns nothing.',
  delivers: 'A secret that needs both recipients to cooperate, with eavesdropping detection built in (Hillery–Bužek–Berthiaume 1999).',
  parties: [
    { qubit: 'alice', who: 'Alice', role: 'the dealer' },
    { qubit: 'bob', who: 'Bob', role: 'shareholder' },
    { qubit: 'charlie', who: 'Charlie', role: 'shareholder' },
  ],
  cost: { ebits: 0, qubitsSent: 2, classicalBits: 3, note: 'One GHZ triple per round; all three announce their bases. About half the rounds are usable.' },
  analogy:
    'A safe with two keyholes: Alice tells Bob half the combination and Charlie the other half, but each half alone is indistinguishable from random digits. Only together do they open it — and a spy who peeks scrambles the halves.',
  keyIdea:
    'For |GHZ⟩ = (|000⟩ + |111⟩)/√2 the product of X·X·X outcomes is always +1, and of X·Y·Y (any two Y’s) always −1. Each person’s single result is a fair coin, so Bob or Charlie alone knows nothing; together, m_A = ±m_B·m_C.',
  limits: 'Rounds with an odd number of Y’s are discarded. A full security proof needs checks against a dishonest shareholder.',
  lab: 'secret-sharing',
  lanes: ['Alice', 'Bob', 'Charlie'],
  flow: [
    { lane: 'Alice', title: 'Make GHZ, send 2 qubits', text: '(|000⟩ + |111⟩)/√2', kind: 'quantum' },
    { lane: 'Bob', title: 'Measure X or Y', text: '', kind: 'measure', via: 'quantum', loop: 'n rounds' },
    { lane: 'Charlie', title: 'Measure X or Y', text: '', kind: 'measure', via: 'quantum', loop: 'n rounds' },
    { lane: 'Alice', title: 'Everyone announces bases', text: 'Keep XXX, XYY, YXY, YYX.', kind: 'classical', via: 'classical' },
    { lane: 'Bob', title: 'Bob + Charlie combine results', text: 'm_A = ±m_B·m_C', kind: 'classical', via: 'classical' },
  ],
  params: ['alice', 'bob', 'charlie'].map((who) => ({
    key: who,
    label: `${who[0].toUpperCase()}${who.slice(1)} measures`,
    options: [{ value: 'X', label: 'X' }, { value: 'Y', label: 'Y' }],
    default: who === 'alice' ? 'X' : 'Y',
  })),
  build({ alice, bob, charlie }) {
    const combo = alice + bob + charlie
    const sign = GHZ_SIGN[combo]
    return {
      qubits: 3,
      labels: ['alice', 'bob', 'charlie'],
      readout: [0, 1, 2],
      steps: [
        { title: 'Alice makes a GHZ state', gates: [gate('h', 0), cx(0, 1), cx(0, 2)], narration: 'All three arrows vanish: every single qubit is maximally mixed.' },
        {
          title: `Measure ${combo.split('').join(' · ')}`,
          gates: [...basisOps(alice, 0), ...basisOps(bob, 1), ...basisOps(charlie, 2)],
          narration: sign
            ? `Valid combination: the number of 1s is always ${sign > 0 ? 'even' : 'odd'} (product of ±1 results = ${sign > 0 ? '+1' : '−1'}). So m_A = ${sign > 0 ? '' : '−'}m_B·m_C — Bob and Charlie together know Alice’s bit.`
            : 'Odd number of Y’s: outcomes are uncorrelated, so this round is discarded.',
          math: '⟨XXX⟩ = +1,  ⟨XYY⟩ = ⟨YXY⟩ = ⟨YYX⟩ = −1',
        },
      ],
      answer: {
        text: sign ? `Parity of the three bits is always ${sign > 0 ? 'even' : 'odd'}.` : 'All 8 outcomes equally likely.',
        check: (d) => {
          const parityOdd = Object.entries(d).reduce((s, [k, p]) => s + ((k.split('').filter((c) => c === '1').length % 2) * p), 0)
          return sign ? Math.abs(parityOdd - (sign > 0 ? 0 : 1)) < 1e-9 : Math.abs(parityOdd - 0.5) < 1e-9
        },
      },
    }
  },
}
