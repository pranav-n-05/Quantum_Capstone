export default {
  id: 'coin-flipping',
  track: 'protocol',
  group: 'crypto',
  dir: { domain: 'Cryptography', function: 'Two distrusting parties agreeing on a random bit', resource: 'Quantum superposition' },
  name: 'Quantum Coin Flipping',
  level: 'Intermediate',
  category: 'Cryptography',
  speedup: 'Limited cheating, not none',
  summary: 'Alice commits to a coin bit by choosing the basis for a string of qubits; Bob guesses it; Alice reveals and Bob checks the qubits. Lying about the basis gets caught with growing probability.',
  delivers: 'A fair-ish random bit between parties who do not trust each other, over a phone line.',
  analogy:
    'Calling a coin toss over the phone is useless — whoever hears second can lie. Here Alice locks her choice into the *way* she wrote a message in invisible ink. If she later claims a different ink, Bob’s spot checks catch the mismatch.',
  keyIdea:
    'Alice’s coin c picks Z or X for k random qubits. Bob measures each in a random basis and guesses c. When Alice reveals, Bob checks the qubits he measured in basis c. Claiming the other basis forces Alice to guess Bob’s random results: she survives with (3/4)ᵏ.',
  limits:
    'This simple BB84-style protocol is broken by an Alice holding entangled pairs (she can decide the basis later). Kitaev proved every strong coin flip leaves some cheater a bias ≥ 1/√2 − ½ ≈ 0.21; weak coin flipping can be made arbitrarily fair (Mochon 2007).',
  lab: 'coin-flipping',
  lanes: ['Alice', 'Bob'],
  flow: [
    { lane: 'Alice', title: 'Secret coin c chooses basis', text: 'c = 0 → Z,  c = 1 → X', kind: 'classical' },
    { lane: 'Alice', title: 'Send k qubits with random values', text: 'All in basis c.', kind: 'quantum' },
    { lane: 'Bob', title: 'Measure each in a random basis', text: '', kind: 'measure', via: 'quantum' },
    { lane: 'Bob', title: 'Announce guess g', text: '', kind: 'classical' },
    { lane: 'Alice', title: 'Reveal c and the values', text: '', kind: 'classical', via: 'classical' },
    { lane: 'Bob', title: 'Check qubits measured in basis c', text: 'Mismatch ⇒ Alice cheated. Result: c ⊕ g.', kind: 'decision', via: 'classical' },
  ],
  params: [],
}
