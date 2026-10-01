export default {
  id: 'cv-qkd',
  track: 'protocol',
  group: 'qkd',
  dir: { domain: 'Key Distribution (QKD)', function: 'QKD using position and momentum of light', resource: 'Squeezed states or coherent states' },
  name: 'Continuous-Variable QKD',
  level: 'Advanced',
  category: 'QKD',
  speedup: 'Telecom-compatible',
  summary: 'Instead of single photons, Alice encodes random real numbers in the amplitude and phase of laser pulses; Bob measures them with standard telecom detectors. Eve’s tampering shows up as extra noise.',
  delivers: 'A secret key using off-the-shelf coherent optics and homodyne detectors.',
  analogy:
    'Instead of sending yes/no light flashes, Alice whispers random numbers by slightly nudging a radio wave. Quantum noise means nobody hears the numbers perfectly; Bob and Alice measure how much extra noise appeared, which caps what Eve could have overheard.',
  keyIdea:
    'Coherent states have unavoidable shot noise in both quadratures (x and p). Alice draws (x_A, p_A) from a Gaussian; Bob measures one quadrature. Their shared information I_AB = ½log₂(1 + SNR). Eve’s maximum knowledge χ_BE follows from the channel’s loss and excess noise ξ, so the key rate is K = β·I_AB − χ_BE.',
  limits:
    'Asymptotic rate, Gaussian collective attacks, reverse reconciliation, ideal detector. Highly sensitive to excess noise and reconciliation efficiency β, which limits distance.',
  lab: 'cv-qkd',
  lanes: ['Alice', 'Bob'],
  flow: [
    { lane: 'Alice', title: 'Draw x_A, p_A ~ Gaussian', text: 'Modulation variance V_A.', kind: 'classical' },
    { lane: 'Alice', title: 'Send coherent state |x_A + i·p_A⟩', text: '', kind: 'quantum' },
    { lane: 'Bob', title: 'Homodyne: measure x or p', text: 'Random choice, announced later.', kind: 'measure', via: 'quantum', loop: 'many pulses' },
    { lane: 'Alice', title: 'Estimate loss T and excess noise ξ', text: 'From a revealed sample.', kind: 'classical', via: 'classical' },
    { lane: 'Bob', title: 'K = β·I_AB − χ_BE > 0?', text: 'Then reconcile (Bob’s data is the reference) and amplify privacy.', kind: 'decision', via: 'classical' },
  ],
  params: [],
}
