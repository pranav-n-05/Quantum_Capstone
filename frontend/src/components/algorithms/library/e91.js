import { e91Correlation, E91_ALICE, E91_BOB } from '../../../quantum/labs/qkd'
import { cx, gate, ry } from './shared'

const deg = (r) => `${Math.round((r * 180) / Math.PI)}°`

export default {
  id: 'e91',
  track: 'protocol',
  group: 'qkd',
  dir: { domain: 'Key Distribution (QKD)', function: "Secure key distribution using Bell's theorem", resource: 'Quantum Entanglement' },
  name: 'E91 (Ekert 1991)',
  level: 'Intermediate',
  category: 'QKD',
  speedup: 'Security from Bell violation',
  summary: 'Alice and Bob measure halves of entangled pairs at random angles. Matching angles give key bits; the rest test a Bell inequality, which any eavesdropper would spoil.',
  delivers: 'A shared key plus a certificate (CHSH |S| = 2√2) that no one else is correlated with it.',
  parties: [
    { qubit: 'alice', who: 'Alice', role: 'measures at 0°, 45° or 90°' },
    { qubit: 'bob', who: 'Bob', role: 'measures at 45°, 90° or 135°' },
  ],
  cost: { ebits: 1, qubitsSent: 2, classicalBits: 1, note: 'A source sends one half to each; the angle choices are announced afterwards.' },
  analogy:
    'Two dice that always land opposite, no matter how far apart. When the players happen to look from the same angle, the results form a key; when they look from different angles, the pattern of agreements is stronger than any pre-arranged trick could produce — proof nobody swapped the dice.',
  keyIdea:
    'For the singlet, ⟨A·B⟩ = −cos(a − b). Combining four angle pairs gives |S| = 2√2 ≈ 2.83, while any local hidden variables — including anything Eve could have fixed by intercepting — give |S| ≤ 2. Observing the violation certifies the key.',
  limits: 'Simulation assumes perfect detectors; real Bell tests must close detection and locality loopholes, which is the root of "device-independent" QKD.',
  lab: 'e91',
  lanes: ['Source', 'Alice', 'Bob'],
  flow: [
    { lane: 'Source', title: 'Make singlet pairs', text: '(|01⟩ − |10⟩)/√2', kind: 'quantum' },
    { lane: 'Alice', title: 'Random angle, measure', text: '0°, 45°, 90°', kind: 'measure', via: 'quantum', loop: 'n pairs' },
    { lane: 'Bob', title: 'Random angle, measure', text: '45°, 90°, 135°', kind: 'measure', via: 'quantum', loop: 'n pairs' },
    { lane: 'Alice', title: 'Announce angles', text: 'Public channel.', kind: 'classical', via: 'classical' },
    { lane: 'Bob', title: 'Same angle → key (flip bit)', text: 'Perfectly anticorrelated.', kind: 'classical', via: 'classical' },
    { lane: 'Bob', title: 'Other angles → CHSH S', text: '|S| ≈ 2√2 ⇒ secure;  ≤ 2 ⇒ abort.', kind: 'decision' },
  ],
  params: [
    { key: 'a', label: 'Alice angle', options: E91_ALICE.map((a, i) => ({ value: String(i), label: deg(a) })), default: '0' },
    { key: 'b', label: 'Bob angle', options: E91_BOB.map((b, i) => ({ value: String(i), label: deg(b) })), default: '0' },
  ],
  build({ a, b }) {
    const ta = E91_ALICE[Number(a)]
    const tb = E91_BOB[Number(b)]
    const E = e91Correlation(ta, tb)
    return {
      qubits: 2,
      labels: ['alice', 'bob'],
      readout: [0, 1],
      steps: [
        {
          title: 'Source makes a singlet',
          gates: [gate('x', 1), gate('h', 0), cx(0, 1), gate('z', 0)],
          narration: '(|01⟩ − |10⟩)/√2: whatever axis both measure, the results are opposite. Both arrows vanish — neither half has a state of its own.',
        },
        {
          title: `Rotate to measure at ${deg(ta)} and ${deg(tb)}`,
          gates: [ry(-ta, 0), ry(-tb, 1)],
          narration:
            Math.abs(ta - tb) < 1e-9
              ? 'Same angle: the outcomes are always opposite. Bob flips his bit and they share a key bit.'
              : `Different angles: the correlation is −cos(${deg(ta)} − ${deg(tb)}) = ${E.toFixed(3)}. Rounds like this feed the CHSH test.`,
          math: '⟨A·B⟩ = −cos(a − b)',
        },
      ],
      answer: {
        text: `Correlation ⟨A·B⟩ = ${E.toFixed(3)}.`,
        check: (d) => Math.abs((d['00'] ?? 0) + (d['11'] ?? 0) - (d['01'] ?? 0) - (d['10'] ?? 0) - E) < 1e-9,
      },
    }
  },
}
