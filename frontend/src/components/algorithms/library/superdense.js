import { cx, gate } from './shared'

export default {
  id: 'superdense',
  track: 'protocol',
  group: 'communication',
  dir: { domain: 'Quantum Communication', function: 'Transmitting two classical bits using one qubit', resource: 'Entanglement (EPR pairs)' },
  keyIdea:
    'The four Bell states are perfectly distinguishable, and Alice can reach any of them by acting on her half alone. Choosing one of four states is two bits — delivered by sending one qubit.',
  limits: 'Only one qubit travels after the message is chosen, but the pair had to be distributed beforehand — the ebit is the hidden cost.',
  flow: [
    { lane: 'Source', title: 'Share a Bell pair', text: 'Before any message exists.', kind: 'quantum' },
    { lane: 'Alice', title: 'Encode 2 bits', text: '00 → I · 01 → Z · 10 → X · 11 → ZX, on her qubit only.', kind: 'quantum', via: 'quantum' },
    { lane: 'Bob', title: 'Receive Alice’s qubit', text: 'The only qubit sent.', kind: 'quantum', via: 'quantum' },
    { lane: 'Bob', title: 'Bell measurement', text: 'CNOT + H, measure both: reads both bits.', kind: 'measure' },
  ],
  delivers: 'Two classical bits down a channel that carries only one qubit.',
  parties: [
    { qubit: 'alice', who: 'Alice', role: 'encodes, then posts this qubit' },
    { qubit: 'bob', who: 'Bob', role: 'held since before the message existed' },
  ],
  cost: { ebits: 1, qubitsSent: 1, classicalBits: 0, note: 'Two bits arrive, but only one qubit was ever sent after the message was chosen.' },
  name: 'Superdense Coding',
  level: 'Beginner',
  category: 'Communication',
  speedup: '2 bits per qubit sent',
  summary: 'Send two classical bits by physically sending just one qubit — teleportation run backwards.',
  analogy:
    'Two pre-agreed secret envelopes. Alice only ever posts one of them back, but by folding it one of four ways she can say one of four things.',
  params: [
    {
      key: 'message',
      label: 'Message (2 bits)',
      options: ['00', '01', '10', '11'].map((value) => ({ value, label: value })),
      default: '10',
    },
  ],
  build({ message }) {
    const useX = message[0] === '1'
    const useZ = message[1] === '1'
    const encode = [...(useX ? [gate('x', 0)] : []), ...(useZ ? [gate('z', 0)] : [])]
    const encoding = useX && useZ ? 'X then Z' : useX ? 'X' : useZ ? 'Z' : 'nothing'

    return {
      qubits: 2,
      labels: ['alice', 'bob'],
      readout: [0, 1],
      steps: [
        {
          title: 'Share a Bell pair',
          gates: [gate('h', 0), cx(0, 1)],
          narration:
            'Ahead of time, Alice and Bob each take one half of an entangled pair. Both arrows shrink to the centre — neither half alone says anything.',
        },
        {
          title: `Alice encodes "${message}"`,
          gates: encode,
          narration: `Alice touches only her own qubit: X for the first bit, Z for the second. For "${message}" she applies ${encoding}. Look at the amplitude bars — the four encodings produce the four different Bell states. Then she posts her single qubit to Bob.`,
          math: '00→I, 01→Z, 10→X, 11→ZX  (one Bell state each)',
        },
        {
          title: 'Bob decodes',
          gates: [cx(0, 1), gate('h', 0)],
          narration:
            'Holding both qubits, Bob runs the Bell pair recipe backwards. That rotates the four Bell states onto the four ordinary bitstrings, so a single measurement reads the full message.',
        },
      ],
      answer: { bits: [message], text: `Always reads ${message}.` },
    }
  },
}
