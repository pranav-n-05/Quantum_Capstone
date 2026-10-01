export default {
  id: 'tf-qkd',
  track: 'protocol',
  group: 'qkd',
  dir: { domain: 'Cryptography / QKD', function: 'Extending QKD beyond standard repeaterless limits', resource: 'Single-photon interference' },
  name: 'Twin-Field QKD (TF-QKD)',
  level: 'Advanced',
  category: 'QKD',
  speedup: 'Rate ∝ √η, beats PLOB',
  summary: 'Alice and Bob each send a weak phase-encoded pulse to a middle station, where a single photon interferes with itself. Because each pulse crosses only half the distance, the key rate falls like √η instead of η.',
  delivers: 'Secret keys over 500+ km of fibre without trusted repeaters.',
  analogy:
    'Two people shout toward a microphone halfway between them rather than at each other. Each voice only has to cross half the field, so far more of the conversation survives — and the microphone only hears how their two voices line up, not what either said.',
  keyIdea:
    'Fibre loses about 0.2 dB/km, so transmittance η falls exponentially. The PLOB bound says no repeaterless point-to-point protocol can beat −log₂(1−η) ≈ 1.44η bits per pulse. TF-QKD is not point-to-point: each photon only crosses half the link (√η), and the middle station only learns the relative phase.',
  limits: 'Rates here use a toy model (ideal single photons, fixed dark-count rate) to show the scaling. Real systems must lock the two lasers’ phases across hundreds of km.',
  lab: 'tf-qkd',
  lanes: ['Alice', 'Middle', 'Bob'],
  flow: [
    { lane: 'Alice', title: 'Weak pulse, random phase + bit', text: '', kind: 'quantum' },
    { lane: 'Bob', title: 'Weak pulse, random phase + bit', text: '', kind: 'quantum' },
    { lane: 'Middle', title: 'Beam splitter + 2 detectors', text: 'Which detector clicks reveals the relative phase only.', kind: 'measure', via: 'quantum' },
    { lane: 'Alice', title: 'Announce phase slices', text: 'Keep rounds whose phases match.', kind: 'classical', via: 'classical' },
    { lane: 'Bob', title: 'Infer bit from click + own bit', text: '', kind: 'classical', via: 'classical' },
  ],
  params: [],
}
