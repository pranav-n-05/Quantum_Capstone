import { fromAngles, KET } from '../../quantum/bloch'

/**
 * "Reach the ghost" puzzles. Each starts from `start`, shows `target` as a
 * violet ghost arrow, and is solved when fidelity ≥ 0.995 within `budget`
 * gates. `allowed` restricts the gate pad (ids from GatePad).
 */
export const CHALLENGES = [
  { id: 'flip', title: 'Flip it', target: KET.one, targetLabel: '|1⟩', budget: 1, hint: 'One half-turn swaps the poles.' },
  { id: 'plus', title: 'Balance point', target: KET.plus, targetLabel: '|+⟩', budget: 1, hint: 'The gate that swaps ẑ and x̂.' },
  { id: 'minus', title: 'Other side', target: KET.minus, targetLabel: '|−⟩', budget: 2, hint: 'Get to the equator, then spin half-way round it.' },
  { id: 'plusI', title: 'Quarter spin', target: KET.plusI, targetLabel: '|+i⟩', budget: 2, hint: 'Equator first, then a quarter-turn about ẑ.' },
  {
    id: 'no-sdg',
    title: 'Without S†',
    target: KET.minusI,
    targetLabel: '|−i⟩',
    budget: 3,
    allowed: ['h', 's', 'z', 'x'],
    hint: 'S† = Z·S. Two quarter-turns make a half-turn.',
  },
  { id: 'magic', title: 'Magic state', target: fromAngles(Math.PI / 2, Math.PI / 4), targetLabel: 'T|+⟩', budget: 2, hint: 'This state powers fault-tolerant T gates. H, then an eighth-turn.' },
  { id: 'home', title: 'Come home', start: KET.plusI, target: KET.zero, targetLabel: '|0⟩', budget: 2, hint: 'Undo the quarter-turn, then undo the H.' },
  { id: 'tilt', title: 'Sixty degrees', target: fromAngles(Math.PI / 3, 0), targetLabel: 'θ=60°, φ=0°', budget: 1, allowed: ['rx', 'ry', 'rz'], hint: 'Which axis tips |0⟩ toward +x̂?' },
  { id: 'side', title: 'Pick the axis', target: fromAngles((2 * Math.PI) / 3, Math.PI / 2), targetLabel: 'θ=120°, φ=90°', budget: 1, allowed: ['rx', 'ry', 'rz'], hint: 'Rotating about x̂ moves |0⟩ through the y–z plane. Mind the sign.' },
  { id: 'universal', title: 'One gate to rule them', target: fromAngles((3 * Math.PI) / 4, -Math.PI / 3), targetLabel: 'θ=135°, φ=−60°', budget: 1, allowed: ['u'], hint: 'From |0⟩, U(θ, φ, λ) lands at (θ, φ).' },
]

export const SOLVED_KEY = 'qtd-bloch-solved'
