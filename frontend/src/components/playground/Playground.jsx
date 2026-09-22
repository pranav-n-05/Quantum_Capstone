import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, Cpu, Play, Sparkles } from 'lucide-react'

import { usePlayground } from '../../hooks/usePlayground'
import CircuitGrid from './CircuitGrid'
import GatePalette from './GatePalette'
import ResultsHistogram from './ResultsHistogram'
import { GATE_BY_KIND } from './gates'

/** Circuits worth having one click away, because typing them out every time
 *  is the difference between a demo that gets used and one that does not. */
const PRESETS = [
  {
    name: 'Bell pair',
    hint: 'Two entangled qubits — only ever 00 or 11',
    qubits: 2,
    ops: [
      { kind: 'h', qubits: [0] },
      { kind: 'cx', qubits: [0, 1] },
    ],
  },
  {
    name: 'GHZ',
    hint: 'Three-qubit entanglement — only 000 or 111',
    qubits: 3,
    ops: [
      { kind: 'h', qubits: [0] },
      { kind: 'cx', qubits: [0, 1] },
      { kind: 'cx', qubits: [1, 2] },
    ],
  },
  {
    name: 'Superposition',
    hint: 'H on every qubit — a flat distribution',
    qubits: 3,
    ops: [
      { kind: 'h', qubits: [0] },
      { kind: 'h', qubits: [1] },
      { kind: 'h', qubits: [2] },
    ],
  },
  {
    name: 'Interference',
    hint: 'H twice cancels — always 0, which randomness cannot fake',
    qubits: 1,
    ops: [
      { kind: 'h', qubits: [0] },
      { kind: 'h', qubits: [0] },
    ],
  },
]

const SHOT_CHOICES = [128, 512, 1024, 2048, 4096]

/** Noisy is first and default: the interesting question is what hardware does. */
const MODES = [
  {
    value: 'noisy',
    label: 'QPU noise',
    title: 'Aer with a superconducting-QPU noise model — closest to real hardware',
  },
  { value: 'ideal', label: 'Ideal', title: 'Aer with no noise — textbook probabilities' },
  { value: 'exact', label: 'Exact', title: 'The dependency-free statevector simulator' },
]

export default function Playground({ backends = [] }) {
  const [qubits, setQubits] = useState(2)
  const [ops, setOps] = useState([])
  const [armed, setArmed] = useState(null)
  const [pendingControl, setPendingControl] = useState(null)
  const [angle, setAngle] = useState(Math.PI / 2)
  const [shots, setShots] = useState(1024)
  const [mode, setMode] = useState('noisy')

  // Drag state. Held here rather than in the grid because a drag that starts in
  // the palette has to be visible to the drop targets in the circuit.
  const [dragging, setDragging] = useState(null)
  const [draggingOpIndex, setDraggingOpIndex] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [hoveredQubit, setHoveredQubit] = useState(null)

  const { result, isRunning, error, run, reset } = usePlayground()

  const circuit = useMemo(() => ({ qubits, ops, shots }), [qubits, ops, shots])

  const handlePlace = useCallback(
    (qubit) => {
      if (!armed) return
      const gate = GATE_BY_KIND[armed]

      if (gate.arity === 1) {
        setOps((current) => [
          ...current,
          { kind: armed, qubits: [qubit], ...(gate.parameterised ? { parameter: angle } : {}) },
        ])
        return
      }

      // Two-qubit gates take two clicks: control, then target.
      if (pendingControl == null) {
        setPendingControl(qubit)
        return
      }
      if (pendingControl === qubit) {
        // Clicking the same wire twice cancels rather than building an illegal
        // self-controlled gate the backend would reject anyway.
        setPendingControl(null)
        return
      }
      setOps((current) => [...current, { kind: armed, qubits: [pendingControl, qubit] }])
      setPendingControl(null)
    },
    [armed, angle, pendingControl],
  )

  /** Place a gate identified explicitly, rather than whatever is armed. */
  const placeKind = useCallback(
    (kind, qubit) => {
      const gate = GATE_BY_KIND[kind]
      if (!gate) return

      if (gate.arity === 1) {
        setOps((current) => [
          ...current,
          { kind, qubits: [qubit], ...(gate.parameterised ? { parameter: angle } : {}) },
        ])
        return
      }

      // A dropped two-qubit gate sets its control and arms the click path for
      // the target: there is no way to express "and also this wire" in a single
      // drag, and inventing one would be worse than two deliberate steps.
      setArmed(kind)
      setPendingControl(qubit)
    },
    [angle],
  )

  const handleDropGate = useCallback(
    (kind, qubit) => {
      setDragging(null)
      // Mid-sequence for a two-qubit gate: the drop supplies the target.
      if (armed && pendingControl != null && GATE_BY_KIND[armed]?.arity === 2) {
        if (pendingControl !== qubit) {
          setOps((current) => [...current, { kind: armed, qubits: [pendingControl, qubit] }])
        }
        setPendingControl(null)
        return
      }
      placeKind(kind, qubit)
    },
    [armed, pendingControl, placeKind],
  )

  const handleReorder = useCallback(
    (from, to) => {
      setDraggingOpIndex(null)
      setDropTarget(null)
      if (from === to || Number.isNaN(from)) return
      setOps((current) => {
        const next = [...current]
        const [moved] = next.splice(from, 1)
        // Removing the dragged item shifts everything after it left by one.
        next.splice(from < to ? to : to, 0, moved)
        return next
      })
    },
    [],
  )

  const handleArm = useCallback((kind) => {
    setArmed(kind)
    setPendingControl(null)
  }, [])

  const handleRemove = useCallback((index) => {
    setOps((current) => current.filter((_, position) => position !== index))
  }, [])

  const handleQubitsChange = useCallback((next) => {
    setQubits(next)
    // Dropping a wire invalidates any gate that used it. Silently discarding
    // those is kinder than surfacing a validation error for a change the user
    // made deliberately.
    setOps((current) => current.filter((op) => op.qubits.every((q) => q < next)))
    setPendingControl(null)
  }, [])

  const applyPreset = useCallback(
    (preset) => {
      setQubits(preset.qubits)
      setOps(preset.ops)
      setArmed(null)
      setPendingControl(null)
      reset()
    },
    [reset],
  )

  const hardwareTargets = backends.filter((backend) => backend.is_operational && !backend.is_simulator)

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <GatePalette
            armed={armed}
            onArm={handleArm}
            onDragStart={setDragging}
            onDragEnd={() => {
              setDragging(null)
              setHoveredQubit(null)
            }}
            angle={angle}
            onAngleChange={setAngle}
            onUndo={() => setOps((current) => current.slice(0, -1))}
            onClear={() => {
              setOps([])
              setPendingControl(null)
              reset()
            }}
            canUndo={ops.length > 0}
            canClear={ops.length > 0}
          />

          <CircuitGrid
            qubits={qubits}
            ops={ops}
            armed={armed}
            dragging={dragging}
            pendingControl={pendingControl}
            onPlace={handlePlace}
            onDropGate={handleDropGate}
            onRemove={handleRemove}
            onReorder={handleReorder}
            onQubitsChange={handleQubitsChange}
            draggingOpIndex={draggingOpIndex}
            onOpDragStart={setDraggingOpIndex}
            onOpDragEnd={() => {
              setDraggingOpIndex(null)
              setDropTarget(null)
            }}
            dropTarget={dropTarget}
            onDropTargetChange={setDropTarget}
            hoveredQubit={hoveredQubit}
            onHoverQubit={setHoveredQubit}
          />

          <section className="panel">
            <h2 className="panel-heading">
              <Sparkles size={13} />
              Presets
            </h2>
            <div className="flex flex-wrap gap-2 px-4 py-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  title={preset.hint}
                  className="rounded-md border border-lab-700 bg-lab-850 px-2.5 py-1.5 text-[11px] text-slate-300 transition-colors hover:border-lab-600 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="panel">
            <h2 className="panel-heading">Run</h2>
            <div className="space-y-3 px-4 py-3">
              <div className="space-y-1.5">
                <span className="block text-[10px] uppercase tracking-wide text-slate-600">
                  Engine
                </span>
                <div
                  role="radiogroup"
                  aria-label="Simulation engine"
                  className="flex items-center rounded-lg border border-lab-700 bg-lab-900/80 p-1"
                >
                  {MODES.map((option) => {
                    const isActive = mode === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        title={option.title}
                        onClick={() => setMode(option.value)}
                        className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 ${
                          isActive
                            ? 'bg-signal-cyan/15 text-signal-cyan'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="shots" className="text-[10px] uppercase tracking-wide text-slate-600">
                  Shots
                </label>
                <select
                  id="shots"
                  value={shots}
                  onChange={(event) => setShots(Number(event.target.value))}
                  className="rounded-md border border-lab-700 bg-lab-850 px-2 py-1 font-mono text-[11px] text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60"
                >
                  {SHOT_CHOICES.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => run(circuit, mode)}
                disabled={isRunning}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-signal-cyan/15 px-3 py-2 text-xs font-medium text-signal-cyan ring-1 ring-signal-cyan/30 transition-colors hover:bg-signal-cyan/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play size={13} />
                {isRunning ? 'Running…' : mode === 'noisy' ? 'Run with QPU noise' : 'Run on simulator'}
              </button>

              <button
                type="button"
                disabled
                title="Hardware submission is not wired up yet — the simulator runs locally with no credentials."
                className="flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-md bg-signal-amber/15 px-3 py-2 text-xs font-medium text-signal-amber opacity-40 ring-1 ring-signal-amber/30"
              >
                <Cpu size={13} />
                Submit to IBM QPU
              </button>

              <p className="text-[10px] leading-relaxed text-slate-600">
                {mode === 'noisy'
                  ? 'Runs through a superconducting-QPU noise model, so a Bell pair errs a few percent of the time — as it would on real hardware. '
                  : 'Noiseless: textbook probabilities with shot noise only. '}
                {hardwareTargets.length > 0
                  ? `${hardwareTargets.length} device${hardwareTargets.length === 1 ? '' : 's'} online for submission.`
                  : 'No devices are currently accepting jobs.'}
              </p>
            </div>
          </section>

          {error && (
            <div className="flex animate-fade-in items-start gap-3 rounded-lg border border-signal-rose/30 bg-signal-rose/10 px-4 py-3">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-signal-rose" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-signal-rose">That circuit was rejected</p>
                <p className="mt-0.5 break-words text-[11px] text-signal-rose/80">{error}</p>
              </div>
            </div>
          )}

          <ResultsHistogram result={result} isRunning={isRunning} />
        </div>
      </div>
    </div>
  )
}
