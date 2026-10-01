import { gate } from './shared'

export default {
  id: 'b92',
  track: 'protocol',
  group: 'qkd',
  dir: { domain: 'Key Distribution (QKD)', function: 'Simplified QKD using only two states', resource: 'Non-orthogonal state indistinguishability' },
  name: 'B92',
  level: 'Beginner',
  category: 'QKD',
  speedup: 'Two states suffice',
  summary: 'Encode 0 as |0⟩ and 1 as |+⟩. Bob keeps only results that rule one state out — rarer, but never wrong without an eavesdropper.',
  delivers: 'A shared key using just two non-orthogonal states.',
  parties: [{ qubit: 'photon', who: 'Alice → Bob', role: '|0⟩ for bit 0, |+⟩ for bit 1' }],
  cost: { ebits: 0, qubitsSent: 1, classicalBits: 1, note: 'Only ~25% of rounds give a conclusive result; Bob announces which.' },
  analogy:
    'Alice sends either a circle or a square, but drawn so faintly they look alike. Bob tests "is it definitely not a circle?" or "definitely not a square?". Usually the test says "can’t tell", but when it does answer, it is never wrong.',
  keyIdea:
    'Two non-orthogonal states cannot be told apart with certainty — but they can sometimes be ruled out. Measuring Z and getting 1 excludes |0⟩ (so bit = 1); measuring X and getting − excludes |+⟩ (so bit = 0). Eve faces the same ambiguity and causes errors.',
  limits: 'Vulnerable to "unambiguous state discrimination" attacks over lossy channels unless a strong reference pulse is added (as in Bennett’s original proposal).',
  lab: 'b92',
  lanes: ['Alice', 'Bob'],
  flow: [
    { lane: 'Alice', title: 'Bit 0 → |0⟩, bit 1 → |+⟩', text: 'Only two states.', kind: 'quantum' },
    { lane: 'Bob', title: 'Measure in Z or X at random', text: '', kind: 'measure', via: 'quantum', loop: 'n rounds' },
    { lane: 'Bob', title: 'Conclusive?', text: 'Z→1 means bit 1;  X→− means bit 0;  else discard.', kind: 'decision' },
    { lane: 'Alice', title: 'Bob announces which rounds he kept', text: 'Not the values.', kind: 'classical', via: 'classical' },
    { lane: 'Alice', title: 'Check errors, distil key', text: '', kind: 'classical' },
  ],
  params: [
    { key: 'bit', label: 'Alice’s bit', options: [{ value: '0', label: '0 → |0⟩' }, { value: '1', label: '1 → |+⟩' }], default: '1' },
    { key: 'bob', label: 'Bob’s basis', options: [{ value: 'Z', label: 'Z' }, { value: 'X', label: 'X' }], default: 'Z' },
  ],
  build({ bit, bob }) {
    // conclusive outcome is 1 in either basis (Z→1 ⇒ bit 1, X→1 i.e. |−⟩ ⇒ bit 0)
    const pConclusive = (bit === '1' && bob === 'Z') || (bit === '0' && bob === 'X') ? 0.5 : 0
    return {
      qubits: 1,
      labels: ['photon'],
      readout: [0],
      steps: [
        { title: `Alice sends ${bit === '1' ? '|+⟩' : '|0⟩'}`, gates: bit === '1' ? [gate('h', 0)] : [], narration: 'The two possible states are 45° apart on the Bloch circle — not orthogonal, so no measurement can tell them apart every time.' },
        {
          title: `Bob measures in ${bob}`,
          gates: bob === 'X' ? [gate('h', 0)] : [],
          narration:
            pConclusive > 0
              ? `Half the time Bob gets outcome 1 here, which rules out the other state: he learns bit ${bit} with certainty.`
              : 'This basis can never produce the ruling-out outcome for this state: Bob always gets 0 and discards the round.',
        },
      ],
      answer: { text: `Conclusive (outcome 1) with probability ${(pConclusive * 100).toFixed(0)}%.`, check: (d) => Math.abs((d['1'] ?? 0) - pConclusive) < 1e-9 },
    }
  },
}
