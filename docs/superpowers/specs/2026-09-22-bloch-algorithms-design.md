# Bloch Lab + Algorithm Debugger — Design

Date: 2026-09-22 · Status: approved

## Goal

Add two views to the dashboard SPA, reachable from the header view switcher at
`http://localhost:5173`:

1. **Bloch Lab** — a complete single-qubit Bloch sphere explorer.
2. **Algorithms** — eight quantum algorithms explained as a step-through
   debugger, so the reader watches the state change gate by gate.

Inspired by sarvan-2187/qrious (Bloch Explorer, Algorithm Explorer), rebuilt in
this project's instrument-console style rather than qrious's text-page style.

## Hard constraints

- Runs entirely locally after one `npm install`. No CDN, no remote fonts, no
  remote HDRI/textures (so no drei `Text`, `Environment` presets, `useTexture`
  on URLs). Sphere labels are HTML overlays.
- No backend required. Both views work with uvicorn stopped.
- Dashboard bundle unchanged: both views are `React.lazy` chunks.

## Architecture

- `frontend/src/quantum/` — dependency-free statevector engine (≤ 6 qubits):
  complex arithmetic, gate matrices, single/controlled/multi-controlled gate
  application, probabilities, per-qubit reduced Bloch vector (partial trace),
  single-qubit helpers (θ/φ ↔ amplitudes, axis-angle rotation, fidelity), and
  T1/T2 relaxation of a Bloch vector. Unit-tested with vitest.
- 3D: `three`, `@react-three/fiber@8`, `@react-three/drei@9` (React 18).
- Navigation: `ViewToggle` gains `bloch` and `algorithms` options.

## Bloch Lab

- Orbitable sphere, axes labelled |0⟩ |1⟩ |+⟩ |−⟩ |+i⟩ |−i⟩, state arrow.
- Every gate animates as the true rotation arc about its axis; fading trail.
- Gate pad: X Y Z H S S† T T†, Rx/Ry/Rz with angle slider and presets,
  custom-axis rotation (n̂, γ), U(θ, φ, λ), direct θ/φ state setters.
- Inspector: α, β (rectangular + polar), P(0)/P(1), (x, y, z), θ/φ, ket text,
  2×2 density matrix.
- Measure: single collapse, or N-shot histogram.
- Decoherence: T1/T2 and elapsed-time sliders shrink the vector into the ball;
  device presets use typical published superconducting-qubit values (the
  telemetry API does not report per-device T1/T2, so presets are labelled
  "typical").
- Timeline: applied-gate chips, undo / redo / reset.
- Challenges: ~10 "reach the ghost target" puzzles with live fidelity meter and
  gate budget.

## Algorithm debugger

- Rail of 8: Bell state, Teleportation, Superdense coding, Deutsch–Jozsa,
  Bernstein–Vazirani, Grover, QFT, Quantum Phase Estimation.
- Circuit strip with playhead; first / prev / play-pause / next / last, speed,
  scrub.
- Amplitude bars: height = |amplitude|, colour = phase (phase wheel).
- One mini Bloch sphere per qubit; reduced-vector length < 1 shows
  entanglement, with an "entangled" badge.
- Per step: plain-English narration, optional "show math", analogy card per
  algorithm, classical-vs-quantum query counter where meaningful.
- Knobs per algorithm (marked item, secret string, oracle type, phase, input
  state); changing a knob rebuilds the steps.
- Library format, one file per algorithm:
  `{ id, name, level, category, speedup, analogy, params, build(params) → { qubits, steps } }`,
  step = `{ gates, title, narration, math? }`.

## Out of scope

Shor / VQE / QAOA, running algorithms on the Aer backend, AI tutor.

## Verification

vitest for the engine (known states, norm preservation, Bell reduced vectors,
each algorithm's final distribution); `vite build`; manual check at
localhost:5173 with the backend stopped.
