import { Plus } from 'lucide-react'

import { GATE_BY_KIND, describeOp, formatAngle } from './gates'

/**
 * The circuit diagram.
 *
 * Laid out column-per-gate rather than row-per-qubit, which looks the same but
 * makes the two-qubit connector trivial: a control and its target live in the
 * same column, so the vertical line joining them is one absolutely positioned
 * div inside that column instead of something spanning grid rows.
 *
 * Each gate occupies its own time step. Real diagrams pack independent gates
 * into shared columns; doing that here would mean solving layout before the
 * user can see what they clicked, and it buys nothing at eight qubits.
 *
 * Two input methods, both first-class: drag a gate from the palette onto a
 * wire, or click to arm and click a wire. Existing gates can be dragged
 * sideways to reorder. Drag alone would strand touch and keyboard users, so
 * the click path is not a fallback -- it is the accessible path.
 */

/** Row pitch in pixels. Shared by the wires, the glyphs and the connector. */
const CELL = 44

const GATE_MIME = 'application/x-gate-kind'
const OP_MIME = 'application/x-op-index'

function Wires({ qubits }) {
  return Array.from({ length: qubits }, (_, q) => (
    <div
      key={q}
      className="absolute left-0 right-0 h-px bg-lab-700"
      style={{ top: q * CELL + CELL / 2 }}
    />
  ))
}

function ControlDot({ row }) {
  return (
    <div
      className="absolute left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal-cyan"
      style={{ top: row * CELL + CELL / 2 }}
    />
  )
}

function TargetRing({ row }) {
  return (
    <div
      className="absolute left-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-signal-cyan bg-lab-900"
      style={{ top: row * CELL + CELL / 2 }}
    >
      <Plus size={12} className="text-signal-cyan" />
    </div>
  )
}

function SwapCross({ row }) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-sm leading-none text-signal-cyan"
      style={{ top: row * CELL + CELL / 2 }}
    >
      ×
    </div>
  )
}

function SingleGateBox({ row, label, angle }) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border border-signal-cyan/40 bg-signal-cyan/15 px-1.5 py-1 text-center"
      style={{ top: row * CELL + CELL / 2, minWidth: 28 }}
    >
      <span className="block font-mono text-[11px] font-medium leading-none text-signal-cyan">
        {label}
      </span>
      {angle != null && (
        <span className="mt-0.5 block font-mono text-[8px] leading-none text-signal-cyan/70">
          {formatAngle(angle)}
        </span>
      )}
    </div>
  )
}

function OpColumn({ op, qubits, onRemove, index, isDragging, dropEdge, onDragStart, onDragEnd, onDragOverColumn, onDropColumn }) {
  const gate = GATE_BY_KIND[op.kind]
  const isTwoQubit = gate?.arity === 2
  const [first, second] = op.qubits

  return (
    <div
      className="relative shrink-0"
      style={{ width: CELL, height: qubits * CELL }}
      onDragOver={(event) => {
        // Reordering only. A gate from the palette lands in the placement
        // column, so an existing column must not swallow that drop.
        if (event.dataTransfer.types.includes(OP_MIME)) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          const box = event.currentTarget.getBoundingClientRect()
          onDragOverColumn(index, event.clientX < box.left + box.width / 2 ? 'before' : 'after')
        }
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes(OP_MIME)) return
        event.preventDefault()
        onDropColumn(Number(event.dataTransfer.getData(OP_MIME)), index)
      }}
    >
      {/* Insertion marker, drawn on whichever edge the pointer is nearer. */}
      {dropEdge && (
        <div
          className="absolute top-0 z-10 h-full w-0.5 bg-signal-violet"
          style={dropEdge === 'before' ? { left: -1 } : { right: -1 }}
        />
      )}

      <button
        type="button"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData(OP_MIME, String(index))
          event.dataTransfer.effectAllowed = 'move'
          onDragStart(index)
        }}
        onDragEnd={onDragEnd}
        onClick={() => onRemove(index)}
        title={`${describeOp(op)} — drag to reorder, click to remove`}
        aria-label={`${describeOp(op)}. Click to remove.`}
        className={`group absolute inset-0 cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-rose/60 ${
          isDragging ? 'opacity-30' : ''
        }`}
      >
        <Wires qubits={qubits} />
        <div className="absolute inset-0 rounded-md transition-colors group-hover:bg-signal-rose/10" />

        {isTwoQubit && (
          <div
            className="absolute w-px -translate-x-1/2 bg-signal-cyan/60"
            style={{
              left: '50%',
              top: Math.min(first, second) * CELL + CELL / 2,
              height: Math.abs(first - second) * CELL,
            }}
          />
        )}

        {isTwoQubit ? (
          op.kind === 'swap' ? (
            <>
              <SwapCross row={first} />
              <SwapCross row={second} />
            </>
          ) : (
            <>
              <ControlDot row={first} />
              {op.kind === 'cx' ? <TargetRing row={second} /> : <ControlDot row={second} />}
            </>
          )
        ) : (
          <SingleGateBox row={first} label={gate?.label ?? op.kind} angle={op.parameter} />
        )}
      </button>
    </div>
  )
}

/** The trailing column of empty slots where the next gate lands. */
function PlacementColumn({ qubits, armed, dragging, pendingControl, onPlace, onDropGate, hoveredQubit, onHoverQubit }) {
  const active = armed ?? dragging
  const gate = active ? GATE_BY_KIND[active] : null
  const needsTwo = gate?.arity === 2

  return (
    <div className="relative shrink-0" style={{ width: CELL, height: qubits * CELL }}>
      <Wires qubits={qubits} />
      {Array.from({ length: qubits }, (_, q) => {
        const isPending = pendingControl === q
        const isHovered = hoveredQubit === q
        const hint = !active
          ? 'Drag a gate here, or pick one from the palette'
          : needsTwo
            ? pendingControl == null
              ? `Set q${q} as the control`
              : isPending
                ? 'Click another qubit for the target'
                : `Use q${q} as the target`
            : `Add ${gate.label} to q${q}`

        return (
          <button
            key={q}
            type="button"
            disabled={!active}
            onClick={() => armed && onPlace(q)}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(GATE_MIME)) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
              onHoverQubit(q)
            }}
            onDragLeave={() => onHoverQubit(null)}
            onDrop={(event) => {
              if (!event.dataTransfer.types.includes(GATE_MIME)) return
              event.preventDefault()
              onHoverQubit(null)
              onDropGate(event.dataTransfer.getData(GATE_MIME), q)
            }}
            title={hint}
            aria-label={hint}
            className={`absolute left-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 ${
              isPending
                ? 'border-signal-violet bg-signal-violet/20 ring-1 ring-signal-violet/40'
                : isHovered
                  ? 'border-signal-cyan bg-signal-cyan/20 ring-1 ring-signal-cyan/40'
                  : active
                    ? 'border-lab-600 bg-lab-850/60 hover:border-signal-cyan/60 hover:bg-signal-cyan/10'
                    : 'border-transparent'
            }`}
            style={{ top: q * CELL + CELL / 2 }}
          />
        )
      })}
    </div>
  )
}

export default function CircuitGrid({
  qubits,
  ops,
  armed,
  dragging,
  pendingControl,
  onPlace,
  onDropGate,
  onRemove,
  onReorder,
  onQubitsChange,
  draggingOpIndex,
  onOpDragStart,
  onOpDragEnd,
  dropTarget,
  onDropTargetChange,
  hoveredQubit,
  onHoverQubit,
}) {
  return (
    <section className="panel">
      <h2 className="panel-heading">
        Circuit
        <span className="font-normal normal-case tracking-normal text-slate-600">
          {ops.length} {ops.length === 1 ? 'gate' : 'gates'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="qubit-count" className="text-[10px] normal-case tracking-normal text-slate-600">
            Qubits
          </label>
          <select
            id="qubit-count"
            value={qubits}
            onChange={(event) => onQubitsChange(Number(event.target.value))}
            className="rounded-md border border-lab-700 bg-lab-850 px-2 py-1 font-mono text-[11px] text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </h2>

      <div
        className="overflow-x-auto px-4 py-4"
        onDragLeave={() => onDropTargetChange(null)}
      >
        <div className="flex items-start">
          {/* Qubit labels, pinned left of the wires. */}
          <div className="shrink-0" style={{ height: qubits * CELL }}>
            {Array.from({ length: qubits }, (_, q) => (
              <div
                key={q}
                className="flex items-center pr-2 font-mono text-[11px] text-slate-500"
                style={{ height: CELL }}
              >
                q{q}
                <span className="ml-1.5 text-slate-700">|0⟩</span>
              </div>
            ))}
          </div>

          {ops.map((op, index) => (
            <OpColumn
              key={index}
              op={op}
              index={index}
              qubits={qubits}
              onRemove={onRemove}
              isDragging={draggingOpIndex === index}
              dropEdge={dropTarget?.index === index ? dropTarget.edge : null}
              onDragStart={onOpDragStart}
              onDragEnd={onOpDragEnd}
              onDragOverColumn={(i, edge) => onDropTargetChange({ index: i, edge })}
              onDropColumn={onReorder}
            />
          ))}

          <PlacementColumn
            qubits={qubits}
            armed={armed}
            dragging={dragging}
            pendingControl={pendingControl}
            onPlace={onPlace}
            onDropGate={onDropGate}
            hoveredQubit={hoveredQubit}
            onHoverQubit={onHoverQubit}
          />

          {/* Measurement is implicit and applies to every qubit, so it is drawn
              once at the end rather than as a placeable gate. */}
          <div className="relative shrink-0 pl-1" style={{ width: 46, height: qubits * CELL }}>
            <Wires qubits={qubits} />
            {Array.from({ length: qubits }, (_, q) => (
              <div
                key={q}
                className="absolute left-1/2 flex h-6 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-lab-600 bg-lab-850"
                style={{ top: q * CELL + CELL / 2 }}
                title="Every qubit is measured at the end of the circuit"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-slate-400" aria-hidden="true">
                  <path
                    d="M2.5 12a5.5 5.5 0 0 1 11 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                  />
                  <path d="M8 12 12 7" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </div>

      {ops.length === 0 && (
        <p className="border-t border-lab-700/50 px-4 py-2.5 text-[11px] text-slate-500">
          Drag a gate onto a wire, or click one and then click a qubit slot. Try{' '}
          <span className="font-mono text-slate-300">H</span> on q0 followed by{' '}
          <span className="font-mono text-slate-300">CX</span> from q0 to q1 — that is a Bell pair,
          and without noise it only ever measures 00 or 11.
        </p>
      )}
    </section>
  )
}
