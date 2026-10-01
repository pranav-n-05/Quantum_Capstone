import { cx, cz, DEG, gate } from './shared'

const INPUTS = {
  one: { label: '|1⟩', theta: 180 * DEG, phi: 0 },
  plus: { label: '|+⟩', theta: 90 * DEG, phi: 0 },
  plusI: { label: '|+i⟩', theta: 90 * DEG, phi: 90 * DEG },
  tilted: { label: 'θ=60°, φ=45° (a "random" state)', theta: 60 * DEG, phi: 45 * DEG },
}

export default {
  id: 'teleportation',
  track: 'protocol',
  group: 'communication',
  dir: { domain: 'Quantum Communication', function: 'Transferring a quantum state to a distant location', resource: 'Entanglement, classical channel' },
  keyIdea:
    'Alice’s Bell measurement leaves Bob’s qubit holding |ψ⟩ up to one of four known errors (I, X, Z, XZ). Her two classical bits name the error, and Bob undoes it. No qubit travels; the original is destroyed, so nothing is cloned.',
  limits: 'The debugger applies Bob’s corrections as controlled gates ("deferred measurement") — mathematically identical to measuring and phoning the bits.',
  flow: [
    { lane: 'Source', title: 'Share a Bell pair', text: 'One half to Alice, one to Bob — ahead of time.', kind: 'quantum' },
    { lane: 'Alice', title: 'Bell measurement', text: 'CNOT + H on (|ψ⟩, her half), then measure both: 2 bits.', kind: 'measure', via: 'quantum' },
    { lane: 'Bob', title: 'Receive 2 classical bits', text: 'Over an ordinary channel — no faster than light.', kind: 'classical', via: 'classical' },
    { lane: 'Bob', title: 'Apply X^{m₁} Z^{m₀}', text: 'His qubit becomes exactly |ψ⟩.', kind: 'quantum' },
  ],
  delivers: 'An unknown qubit state, moved without the qubit itself travelling.',
  parties: [
    { qubit: 'msg', who: 'Alice', role: 'the unknown state to send' },
    { qubit: 'alice', who: 'Alice', role: 'her half of the shared pair' },
    { qubit: 'bob', who: 'Bob', role: 'his half — becomes the message' },
  ],
  cost: { ebits: 1, qubitsSent: 0, classicalBits: 2, note: 'The two bits travel no faster than light, which is why this cannot signal.' },
  name: 'Quantum Teleportation',
  level: 'Beginner',
  category: 'Communication',
  speedup: 'Not possible classically',
  summary: 'Move an unknown qubit state to a distant qubit using one shared Bell pair and two classical bits.',
  analogy:
    'A fax machine that shreds the original. Alice never learns what the page said, the page itself never travels, and only after two ordinary phone-call bits arrive can Bob reassemble an exact copy.',
  params: [
    {
      key: 'input',
      label: 'State to teleport',
      options: Object.entries(INPUTS).map(([value, v]) => ({ value, label: v.label })),
      default: 'tilted',
    },
  ],
  build({ input }) {
    const { theta, phi } = INPUTS[input]
    return {
      qubits: 3,
      labels: ['msg', 'alice', 'bob'],
      readout: [2],
      steps: [
        {
          title: 'The message',
          gates: [gate('u', 0, { params: [theta, phi, 0] })],
          narration:
            "q0 holds the state we want to send. Note where its arrow points — at the end, Bob's arrow will point exactly there.",
          math: '|ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩',
        },
        {
          title: 'Make a Bell pair…',
          gates: [gate('h', 1)],
          narration: 'Alice puts her qubit into superposition, ready to entangle it with Bob’s.',
        },
        {
          title: '…and share it',
          gates: [cx(1, 2)],
          narration:
            'Alice and Bob now share an entangled pair; their arrows collapse to the centre. Imagine Bob walking away with his half — distance does not matter from here on.',
        },
        {
          title: 'Alice mixes in the message',
          gates: [cx(0, 1), gate('h', 0)],
          narration:
            "A CNOT and a Hadamard tangle the message into Alice's half of the pair. Every arrow is now shrunk: the message has been smeared across all three qubits and no single qubit holds it.",
          math: 'Each of the 4 outcomes of (msg, alice) leaves Bob with |ψ⟩ up to X and/or Z',
        },
        {
          title: 'Bob repairs his qubit',
          gates: [cx(1, 2), cz([0], 2)],
          narration:
            "Normally Alice measures and phones Bob two bits; he applies X if the first is 1 and Z if the second is 1. Here those corrections are done with controlled gates instead (the 'deferred measurement' trick) — same result. Bob’s arrow snaps back out to full length, pointing exactly where the message started.",
          math: 'X^{m₁} Z^{m₀} applied to Bob  ⇒  Bob = |ψ⟩',
        },
      ],
      answer: { text: "Bob's sphere (q2) ends identical to the message's starting sphere." },
      target: { qubit: 2, theta, phi },
    }
  },
}
