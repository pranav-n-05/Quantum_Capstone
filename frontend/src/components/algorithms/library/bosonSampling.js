export default {
  id: 'boson-sampling',
  track: 'algorithm',
  group: 'simulation',
  dir: { problem: 'Sampling probability distribution of bosons', advantage: 'Hard classically (#P-hard)', mechanism: 'Linear optical networks' },
  name: 'Boson Sampling',
  level: 'Advanced',
  category: 'Photonics',
  speedup: '#P-hard to simulate',
  summary: 'Send identical photons through a random network of beam splitters and record where they exit. Predicting that distribution needs matrix permanents — believed intractable classically.',
  analogy:
    'A pachinko machine where the balls are indistinguishable twins: their paths interfere, so they bunch together in ways ordinary balls never would. Two twins at a 50:50 mirror always leave together — never one each way.',
  keyIdea:
    'For k photons in an m-mode interferometer U, the chance of output pattern S is |Perm(U_S)|². Determinants are easy; permanents are #P-hard (Valiant). Distinguishable particles give Perm(|U_S|²), which is easy to approximate — the gap between the two is the quantum signature.',
  limits:
    'Not a qubit-gate algorithm and solves no useful problem; it is a demonstration of quantum advantage (Jiuzhang, 2020). Here: 3 photons in 6 modes, computed exactly.',
  lab: 'boson-sampling',
  flow: [
    { lane: 'Photonic chip', title: 'Inject k single photons', text: 'Into k of the m input modes.', kind: 'quantum' },
    { lane: 'Photonic chip', title: 'Random interferometer U', text: 'Beam splitters + phase shifters.', kind: 'quantum' },
    { lane: 'Photonic chip', title: 'Detect output pattern S', text: 'Which modes the photons left by.', kind: 'measure', loop: 'many samples' },
    { lane: 'Classical computer', title: 'Verify against |Perm(U_S)|²', text: 'Feasible only for small k.', kind: 'classical', via: 'classical' },
  ],
  params: [],
}
