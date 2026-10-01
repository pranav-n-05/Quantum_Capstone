import { DEG, gate } from './shared'

const STATES = {
  plus: { label: '|+⟩', theta: 90 * DEG, phi: 0 },
  tilted: { label: 'θ=60°, φ=45°', theta: 60 * DEG, phi: 45 * DEG },
  plusI: { label: '|+i⟩', theta: 90 * DEG, phi: 90 * DEG },
  one: { label: '|1⟩', theta: Math.PI, phi: 0 },
}
const AXIS = { X: [gate('h', 0)], Y: [{ g: 'sdg', t: [0] }, gate('h', 0)], Z: [] }

export default {
  id: 'tomography',
  track: 'protocol',
  group: 'characterization',
  dir: { domain: 'Characterization', function: 'Reconstructing the complete quantum state', resource: 'Repeated varied measurements' },
  name: 'Quantum State Tomography',
  level: 'Beginner',
  category: 'Characterization',
  speedup: 'Error ∝ 1/√shots',
  summary: 'One measurement tells you almost nothing about a qubit. Measuring many identical copies along X, Y and Z gives the three Bloch-vector components — the full state.',
  delivers: 'The density matrix of an unknown state — how experimenters check that a device made what it should.',
  analogy:
    'Working out a sculpture’s shape from photographs: one photo is ambiguous, but shadows from three perpendicular lamps pin it down. More photos per lamp sharpen the picture.',
  keyIdea:
    'ρ = (I + xX + yY + zZ)/2, and each coefficient is an expectation value: x = ⟨X⟩ = P(+) − P(−) along X, and likewise for y and z. Estimating each from N shots has statistical error ~1/√N; n qubits need 3ⁿ settings, which is why tomography only scales to a few qubits.',
  limits: 'Linear inversion with projection back onto the sphere. Maximum-likelihood or Bayesian estimators do better with few shots.',
  lab: 'tomography',
  lanes: ['Source', 'Lab'],
  flow: [
    { lane: 'Source', title: 'Prepare many copies of ρ', text: '', kind: 'quantum' },
    { lane: 'Lab', title: 'Measure N copies in X', text: '⟨X⟩ = 2·k/N − 1', kind: 'measure', via: 'quantum' },
    { lane: 'Lab', title: 'Measure N copies in Y', text: '⟨Y⟩', kind: 'measure' },
    { lane: 'Lab', title: 'Measure N copies in Z', text: '⟨Z⟩', kind: 'measure' },
    { lane: 'Lab', title: 'ρ̂ = (I + ⟨X⟩X + ⟨Y⟩Y + ⟨Z⟩Z)/2', text: 'Project onto valid states if needed.', kind: 'classical' },
  ],
  params: [
    { key: 'state', label: 'Hidden state', options: Object.entries(STATES).map(([value, s]) => ({ value, label: s.label })), default: 'tilted' },
    { key: 'axis', label: 'Measure along', options: ['X', 'Y', 'Z'].map((value) => ({ value, label: value })), default: 'X' },
  ],
  build({ state, axis }) {
    const { theta, phi } = STATES[state]
    const comp = { X: Math.sin(theta) * Math.cos(phi), Y: Math.sin(theta) * Math.sin(phi), Z: Math.cos(theta) }[axis]
    const p0 = (1 + comp) / 2
    return {
      qubits: 1,
      labels: ['q'],
      readout: [0],
      steps: [
        { title: 'Prepare one copy', gates: [{ g: 'u', t: [0], params: [theta, phi, 0] }], narration: 'Pretend we don’t know this state — the device made it, we want to check.' },
        {
          title: `Rotate so ${axis} becomes Z`,
          gates: AXIS[axis],
          narration: `Measuring "along ${axis}" means rotating ${axis} onto the z axis and measuring normally. P(0) = (1 + ⟨${axis}⟩)/2 = ${p0.toFixed(3)}, so ⟨${axis}⟩ = ${comp.toFixed(3)}. One shot only gives 0 or 1 — the Lab tab repeats it thousands of times.`,
        },
      ],
      answer: { text: `P(0) = ${p0.toFixed(3)} ⇒ ⟨${axis}⟩ = ${comp.toFixed(3)}.`, check: (d) => Math.abs((d['0'] ?? 0) - p0) < 1e-9 },
    }
  },
}
