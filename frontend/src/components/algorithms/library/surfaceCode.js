export default {
  id: 'surface-code',
  track: 'protocol',
  group: 'qec',
  dir: { domain: 'Error Correction', function: 'Topological error correction for 2D hardware', resource: 'Topological entanglement, Anyons' },
  name: 'Surface Codes (Kitaev)',
  level: 'Advanced',
  category: 'Error correction',
  speedup: 'Highest threshold (~1%)',
  summary: 'Data qubits on a grid; small parity checks on every square. Errors show up as lit-up squares at the ends of error chains, and a decoder pairs them up. Only local, nearest-neighbour operations are needed.',
  delivers: 'The leading route to fault-tolerant quantum computers (Google’s 2024 below-threshold demonstration).',
  analogy:
    'A tiled floor with a sensor in every tile that checks its four corners. A crack (error chain) only trips the sensors at its two ends; you repair along the shortest path between them. The floor is ruined only if a crack spans from one wall to the opposite wall.',
  keyIdea:
    'Logical information is stored non-locally — a logical operator is a chain across the whole grid. Local errors make short chains whose endpoints are detected; matching them up fixes everything except chains as long as the code distance d. Below a threshold error rate, growing d suppresses logical errors exponentially.',
  limits: 'Distance-3 rotated code (9 data, 8 checks), Pauli errors, perfect syndrome measurement, exact minimum-weight decoding by lookup. Real decoders also handle measurement errors over time.',
  lab: 'surface-code',
  lanes: ['Hardware', 'Decoder'],
  flow: [
    { lane: 'Hardware', title: 'Data qubits on a d×d grid', text: 'X- and Z-checks on alternating squares.', kind: 'quantum' },
    { lane: 'Hardware', title: 'Measure every check', text: 'Each touches ≤ 4 neighbours.', kind: 'measure', loop: 'every cycle' },
    { lane: 'Decoder', title: 'Lit checks = chain endpoints', text: '', kind: 'classical', via: 'classical', loop: 'every cycle' },
    { lane: 'Decoder', title: 'Pair them up (min. weight)', text: 'Shortest correction chains.', kind: 'classical' },
    { lane: 'Decoder', title: 'Did a chain cross the patch?', text: 'Yes ⇒ logical error;  no ⇒ corrected.', kind: 'decision' },
  ],
  params: [],
}
