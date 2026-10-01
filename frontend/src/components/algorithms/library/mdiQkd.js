import { bellProbabilities, mdiFlip } from '../../../quantum/labs/qkd'
import { cx, gate } from './shared'

const STATES = { Z0: '|0⟩ (Z, 0)', Z1: '|1⟩ (Z, 1)', X0: '|+⟩ (X, 0)', X1: '|−⟩ (X, 1)' }
const prep = (key, q) => [...(key[1] === '1' ? [gate('x', q)] : []), ...(key[0] === 'X' ? [gate('h', q)] : [])]
// After CNOT(0→1), H(0) the Bell states land on these readout keys (q1 q0).
const KEYS = { 'Φ+': '00', 'Φ−': '01', 'Ψ+': '10', 'Ψ−': '11' }

export default {
  id: 'mdi-qkd',
  track: 'protocol',
  group: 'qkd',
  dir: { domain: 'Cryptography', function: 'Removes vulnerabilities in practical detectors', resource: 'Two-photon interference (HOM)' },
  name: 'MDI-QKD',
  level: 'Advanced',
  category: 'QKD',
  speedup: 'Immune to detector attacks',
  summary: 'Alice and Bob both send BB84 states to an untrusted middleman, Charlie, who performs a Bell measurement. His announcement correlates their bits but reveals nothing about them.',
  delivers: 'A secret key even if the measurement station is built by the adversary.',
  parties: [
    { qubit: 'A', who: 'Alice', role: 'sends a BB84 state' },
    { qubit: 'B', who: 'Bob', role: 'sends a BB84 state' },
  ],
  cost: { ebits: 0, qubitsSent: 2, classicalBits: 3, note: 'Two photons per round to Charlie; he announces his Bell result, then the bases are compared.' },
  analogy:
    'Two people each drop a sealed envelope into a machine run by a stranger. The machine only says "your envelopes match" or "they differ" — never what is inside. If the stranger tampers, the match/differ answers stop agreeing with spot checks.',
  keyIdea:
    'Detectors are where real QKD systems get hacked (blinding, time-shift attacks). Here all detection happens at Charlie, who is untrusted. A Bell-state result only reveals the *parity* of Alice’s and Bob’s bits; with matching bases that parity lets Bob reconstruct Alice’s bit.',
  limits: 'With linear optics only Ψ⁺ and Ψ⁻ can be identified, so at most half of the Bell outcomes are usable. Requires the two independent lasers to produce indistinguishable photons.',
  lab: 'mdi-qkd',
  lanes: ['Alice', 'Charlie', 'Bob'],
  flow: [
    { lane: 'Alice', title: 'Random BB84 state', text: '', kind: 'quantum' },
    { lane: 'Bob', title: 'Random BB84 state', text: '', kind: 'quantum' },
    { lane: 'Charlie', title: 'Bell measurement (untrusted)', text: 'Announces Ψ⁺ or Ψ⁻, or "failed".', kind: 'measure', via: 'quantum' },
    { lane: 'Alice', title: 'Compare bases publicly', text: 'Keep matching-basis Ψ± rounds.', kind: 'classical', via: 'classical' },
    { lane: 'Bob', title: 'Flip his bit if needed', text: 'Z: always flip · X: flip on Ψ⁻.', kind: 'classical', via: 'classical' },
  ],
  params: [
    { key: 'alice', label: 'Alice sends', options: Object.entries(STATES).map(([value, label]) => ({ value, label })), default: 'Z0' },
    { key: 'bob', label: 'Bob sends', options: Object.entries(STATES).map(([value, label]) => ({ value, label })), default: 'Z1' },
  ],
  build({ alice, bob }) {
    const probs = bellProbabilities({ basis: alice[0], bit: Number(alice[1]) }, { basis: bob[0], bit: Number(bob[1]) })
    const likely = Object.entries(probs).filter(([, p]) => p > 1e-9).map(([k]) => k)
    const same = alice[0] === bob[0]
    const verdict = same
      ? likely
          .filter((k) => k[0] === 'Ψ')
          .map((k) => `${k} → Bob ${mdiFlip(bob[0], k) ? 'flips' : 'keeps'} his bit → ${mdiFlip(bob[0], k) ? 1 - Number(bob[1]) : bob[1]} = Alice’s ${alice[1]}`)
          .join('; ') || 'no Ψ outcome possible: Charlie reports failure'
      : 'different bases: round discarded'
    return {
      qubits: 2,
      labels: ['A', 'B'],
      readout: [0, 1],
      steps: [
        { title: 'Alice and Bob prepare', gates: [...prep(alice, 0), ...prep(bob, 1)], narration: `Alice sends ${STATES[alice]}, Bob sends ${STATES[bob]}. Neither trusts Charlie.` },
        {
          title: 'Charlie’s Bell measurement',
          gates: [cx(0, 1), gate('h', 0)],
          narration: `Readout 00 = Φ⁺, 01 = Φ⁻, 10 = Ψ⁺, 11 = Ψ⁻. Possible here: ${likely.join(', ')}. ${verdict}.`,
          math: 'Ψ± ⇒ bits differ in Z;  Ψ⁺ ⇒ same, Ψ⁻ ⇒ differ in X',
        },
      ],
      answer: {
        text: `Bell outcomes: ${likely.map((k) => `${k} ${(probs[k] * 100).toFixed(0)}%`).join(', ')}.`,
        check: (d) => Object.entries(KEYS).every(([bell, key]) => Math.abs((d[key] ?? 0) - probs[bell]) < 1e-9),
      },
    }
  },
}
