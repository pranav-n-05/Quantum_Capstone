export default {
  id: 'decoy-state',
  track: 'protocol',
  group: 'qkd',
  dir: { domain: 'Cryptography / QKD', function: 'Defeating photon-number-splitting attacks', resource: 'Attenuated laser pulses' },
  name: 'Decoy-State Protocol',
  level: 'Intermediate',
  category: 'QKD',
  speedup: 'Makes BB84 practical with lasers',
  summary: 'Real QKD uses dim laser pulses, which sometimes hold two photons — Eve can steal one. Mixing in pulses of other brightness (decoys) exposes her.',
  delivers: 'A trustworthy bound on how many key bits came from genuine single photons.',
  analogy:
    'A courier sometimes carries two identical letters and a thief pockets one. To catch him you secretly send some extra-thin and some empty envelopes too. An honest road loses all sizes alike; a thief who drops singles and steals from doubles changes the ratios.',
  keyIdea:
    'A laser pulse of mean photon number μ holds n photons with Poisson probability e^{−μ}μⁿ/n!. Eve’s photon-number-splitting (PNS) attack blocks single-photon pulses and lets multi-photon ones through. She can fake the signal’s click rate — but not simultaneously for decoys of different μ, because the photon-number mix differs. The decoy click rates pin down the single-photon yield Y₁.',
  limits: 'Uses the vacuum + weak decoy bound of Lo, Ma & Chen (2005). Finite-key effects and detector imperfections are left out.',
  lab: 'decoy-state',
  lanes: ['Alice', 'Eve', 'Bob'],
  flow: [
    { lane: 'Alice', title: 'Pick intensity at random', text: 'signal μ ≈ 0.5, decoy ν ≈ 0.1, or vacuum.', kind: 'classical' },
    { lane: 'Alice', title: 'Send BB84 pulse', text: 'Bob cannot tell which intensity it was.', kind: 'quantum' },
    { lane: 'Eve', title: '(Maybe) PNS attack', text: 'Block singles, split multiples.', kind: 'quantum', via: 'quantum' },
    { lane: 'Bob', title: 'Detect and sift as BB84', text: '', kind: 'measure', via: 'quantum' },
    { lane: 'Alice', title: 'Reveal intensities', text: 'Compute click rate (gain) per intensity.', kind: 'classical', via: 'classical' },
    { lane: 'Bob', title: 'Bound Y₁ from the gains', text: 'Y₁ too low ⇒ attack ⇒ abort.', kind: 'decision' },
  ],
  params: [],
}
