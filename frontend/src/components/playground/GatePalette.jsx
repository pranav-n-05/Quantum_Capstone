import { RotateCcw, Trash2 } from 'lucide-react'

import { ANGLE_PRESETS, GATES, formatAngle } from './gates'

/**
 * The gate tray.
 *
 * Gates can be dragged onto a wire or clicked to arm and then placed. Both
 * paths exist on purpose: dragging is the obvious gesture with a mouse, and
 * click-to-place is the one that still works on a touchscreen, survives a
 * mis-drag, and can be driven from the keyboard.
 *
 * The drag uses native HTML5 events rather than a library -- dnd-kit would be
 * this project's first runtime dependency in its history, for a gesture the
 * platform already implements.
 */
export default function GatePalette({
  armed,
  onArm,
  onDragStart,
  onDragEnd,
  angle,
  onAngleChange,
  onUndo,
  onClear,
  canUndo,
  canClear,
}) {
  const armedIsRotation = armed && GATES.find((gate) => gate.kind === armed)?.parameterised

  return (
    <section className="panel">
      <h2 className="panel-heading">
        Gates
        <span className="ml-auto font-normal normal-case tracking-normal text-slate-600">
          {armed ? 'now click a qubit' : 'drag onto a wire, or click'}
        </span>
      </h2>

      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {GATES.map((gate) => {
          const isArmed = armed === gate.kind
          return (
            <button
              key={gate.kind}
              type="button"
              draggable
              onDragStart={(event) => {
                // A custom type keeps this drag from being interpreted by
                // anything else on the page; the text/plain copy is what makes
                // the gate droppable into an editor or a notes app.
                event.dataTransfer.setData('application/x-gate-kind', gate.kind)
                event.dataTransfer.setData('text/plain', gate.label)
                event.dataTransfer.effectAllowed = 'copy'
                onDragStart?.(gate.kind)
              }}
              onDragEnd={() => onDragEnd?.()}
              onClick={() => onArm(isArmed ? null : gate.kind)}
              title={`${gate.title} — drag onto a wire, or click then click a qubit`}
              aria-pressed={isArmed}
              className={`min-w-[38px] cursor-grab rounded-md px-2 py-1.5 font-mono text-xs font-medium transition-colors active:cursor-grabbing focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 ${
                isArmed
                  ? 'bg-signal-cyan/15 text-signal-cyan ring-1 ring-signal-cyan/40'
                  : 'border border-lab-700 bg-lab-850 text-slate-300 hover:border-lab-600 hover:text-slate-100'
              }`}
            >
              {gate.label}
            </button>
          )
        })}
      </div>

      {/* The angle control only exists while it can actually be applied. */}
      {armedIsRotation && (
        <div className="flex animate-fade-in flex-wrap items-center gap-2 border-t border-lab-700/50 px-4 py-2.5">
          <span className="text-[10px] uppercase tracking-wide text-slate-600">Angle</span>
          {ANGLE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onAngleChange(preset.value)}
              className={`rounded-md px-2 py-1 font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 ${
                Math.abs(angle - preset.value) < 1e-9
                  ? 'bg-signal-violet/15 text-signal-violet ring-1 ring-signal-violet/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <input
            type="number"
            step="0.01"
            value={Number(angle.toFixed(4))}
            onChange={(event) => onAngleChange(Number(event.target.value))}
            aria-label="Rotation angle in radians"
            className="w-24 rounded-md border border-lab-700 bg-lab-850 px-2 py-1 font-mono text-[11px] text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60"
          />
          <span className="font-mono text-[11px] text-slate-500">rad = {formatAngle(angle)}</span>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-lab-700/50 px-4 py-2.5">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Remove the last gate"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-slate-500 transition-colors hover:text-slate-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <RotateCcw size={12} />
          Undo
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!canClear}
          title="Remove every gate"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-slate-500 transition-colors hover:text-signal-rose focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>
    </section>
  )
}
