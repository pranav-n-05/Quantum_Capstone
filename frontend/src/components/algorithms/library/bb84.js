import { cx, gate } from './shared'

const PHOTON = 0
const PROBE = 1
const basisOps = (basis, q) => (basis === 'X' ? [gate('h', q)] : [])

export default {
  id: 'bb84',
  track: 'protocol',
  group: 'qkd',
  dir: { domain: 'Key Distribution (QKD)', function: 'Securely establishing a shared cryptographic key', resource: 'Single photons, non-orthogonal bases' },
  name: 'BB84 (Bennett–Brassard)',
  level: 'Beginner',
  category: 'QKD',
  speedup: 'Eavesdropping is detectable',
  summary: 'Alice sends single photons in random bases; Bob measures in random bases; they keep the matching ones. A spy must guess bases and inevitably leaves errors.',
  delivers: 'A shared secret key, with a guarantee: any eavesdropping shows up as errors.',
  parties: [
    { qubit: 'photon', who: 'Alice → Bob', role: 'one qubit per round, in basis Z (↕︎↔︎) or X (⤢⤡)' },
    { qubit: 'eve', who: 'Eve', role: 'her probe — measuring means entangling with it' },
  ],
  cost: { ebits: 0, qubitsSent: 1, classicalBits: 1, note: 'Per raw round: one photon, then a public basis announcement. About half the rounds survive sifting.' },
  analogy:
    'Sending notes written in one of two invisible inks. Bob guesses which lamp to read each with; afterwards they compare lamps (not messages) and keep the notes read with the right lamp. A spy who reads with the wrong lamp smudges the ink — and the smudges are countable.',
  keyIdea:
    'Measuring a Z-basis state in X gives a coin flip and destroys the original. Eve does not know the basis, so she picks wrong half the time and then Bob sees the wrong bit half of those times: 25% errors in the sifted key. Low error ⇒ little information leaked.',
  limits: 'Ideal single photons and an authenticated classical channel are assumed. Real lasers emit multi-photon pulses — see the Decoy-State protocol.',
  lab: 'bb84',
  lanes: ['Alice', 'Eve', 'Bob'],
  flow: [
    { lane: 'Alice', title: 'Random bit + random basis', text: 'Z: 0→↔︎, 1→↕︎   ·   X: 0→⤢, 1→⤡', kind: 'classical' },
    { lane: 'Alice', title: 'Send one photon', text: '', kind: 'quantum' },
    { lane: 'Eve', title: '(Maybe) intercept–resend', text: 'Guesses a basis, measures, re-sends.', kind: 'measure', via: 'quantum' },
    { lane: 'Bob', title: 'Measure in a random basis', text: '', kind: 'measure', via: 'quantum', loop: 'n rounds' },
    { lane: 'Alice', title: 'Announce bases (not bits)', text: 'Public channel.', kind: 'classical', via: 'classical' },
    { lane: 'Bob', title: 'Sift: keep matching bases', text: '≈ half the rounds.', kind: 'classical', via: 'classical' },
    { lane: 'Bob', title: 'Sample error rate (QBER)', text: '> 11% ⇒ abort.', kind: 'decision' },
    { lane: 'Alice', title: 'Error correction + privacy amplification', text: 'Shrink the key so Eve’s knowledge → 0.', kind: 'classical', via: 'classical' },
  ],
  params: [
    { key: 'bit', label: 'Alice’s bit', options: [{ value: '0', label: '0' }, { value: '1', label: '1' }], default: '1' },
    { key: 'alice', label: 'Alice’s basis', options: [{ value: 'Z', label: 'Z (↕︎↔︎)' }, { value: 'X', label: 'X (⤢⤡)' }], default: 'Z' },
    { key: 'eve', label: 'Eve', options: [{ value: 'none', label: 'absent' }, { value: 'Z', label: 'measures in Z' }, { value: 'X', label: 'measures in X' }], default: 'X' },
    { key: 'bob', label: 'Bob’s basis', options: [{ value: 'Z', label: 'Z' }, { value: 'X', label: 'X' }], default: 'Z' },
  ],
  build({ bit, alice, eve, bob }) {
    const sameAB = alice === bob
    const disturbed = eve !== 'none' && eve !== alice
    const pRight = !sameAB ? 0.5 : disturbed ? 0.5 : 1
    const steps = [
      {
        title: `Alice sends bit ${bit} in ${alice}`,
        gates: [...(bit === '1' ? [gate('x', PHOTON)] : []), ...basisOps(alice, PHOTON)],
        narration: `X sets the bit, H picks the X basis. The photon’s Bloch arrow points along ${alice === 'Z' ? 'z' : 'x'}.`,
      },
    ]
    if (eve !== 'none')
      steps.push({
        title: `Eve measures in ${eve}`,
        gates: [...basisOps(eve, PHOTON), cx(PHOTON, PROBE), ...basisOps(eve, PHOTON)],
        narration:
          eve === alice
            ? 'Eve guessed the right basis: she learns the bit and the photon is undisturbed. She got lucky — this happens half the time.'
            : 'Eve guessed the wrong basis. Recording the result entangles her probe with the photon: the photon’s arrow shrinks to the centre — its original state is gone.',
        math: 'measurement = CNOT into a probe, in the measured basis',
      })
    steps.push({
      title: `Bob measures in ${bob}`,
      gates: basisOps(bob, PHOTON),
      narration: !sameAB
        ? 'Bob’s basis differs from Alice’s, so his result is a coin flip. This round is discarded at sifting.'
        : disturbed
          ? `Same basis as Alice — this round is kept — but Eve’s wrong-basis measurement makes Bob read ${bit} only 50% of the time. That 50% error on a quarter of the rounds is the 25% QBER that exposes her.`
          : `Same basis, no disturbance: Bob reads ${bit} with certainty.`,
    })
    return {
      qubits: eve === 'none' ? 1 : 2,
      labels: eve === 'none' ? ['photon'] : ['photon', 'eve'],
      readout: [PHOTON],
      steps,
      answer: { text: `Bob reads Alice’s bit with probability ${(pRight * 100).toFixed(0)}%.`, check: (d) => Math.abs((d[bit] ?? 0) - pRight) < 1e-9 },
    }
  },
}
