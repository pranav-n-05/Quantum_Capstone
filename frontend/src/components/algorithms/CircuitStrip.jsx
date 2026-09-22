import { useEffect, useMemo, useRef } from 'react'

import { useThemeColors } from '../../hooks/useThemeColors'

/**
 * The circuit, drawn step by step with a playhead.
 *
 * Gates inside a step are packed into columns greedily (a gate joins the
 * current column unless it overlaps something already there), so "H on every
 * qubit" draws as one column rather than a staircase.
 */

const COL = 44
const ROW = 38
const PAD_X = 12
const LABEL_W = 44
const STEP_GAP = 10
const TOP = 22

const LABEL = { h: 'H', x: 'X', y: 'Y', z: 'Z', s: 'S', sdg: 'S†', t: 'T', tdg: 'T†', rx: 'Rx', ry: 'Ry', rz: 'Rz', p: 'P', u: 'U', cp: 'P' }

function span(op) {
  const qs = [...op.t, ...(op.c ?? [])]
  return [Math.min(...qs), Math.max(...qs)]
}

function packColumns(ops) {
  const cols = []
  for (const op of ops) {
    const [lo, hi] = span(op)
    const current = cols[cols.length - 1]
    const clash = current?.some((o) => {
      const [a, b] = span(o)
      return !(hi < a || lo > b)
    })
    if (!current || clash) cols.push([op])
    else current.push(op)
  }
  return cols
}

function Gate({ op, x, y, colors }) {
  const color = colors['signal-cyan']
  const lineColor = colors['slate-400']
  const [lo, hi] = span(op)
  const multi = lo !== hi

  if (op.g === 'swap') {
    const [a, b] = op.t
    const cross = (q) => (
      <g key={q} stroke={lineColor} strokeWidth={1.6}>
        <line x1={x - 6} y1={y(q) - 6} x2={x + 6} y2={y(q) + 6} />
        <line x1={x - 6} y1={y(q) + 6} x2={x + 6} y2={y(q) - 6} />
      </g>
    )
    return (
      <g>
        <line x1={x} y1={y(a)} x2={x} y2={y(b)} stroke={lineColor} strokeWidth={1.4} />
        {cross(a)}
        {cross(b)}
      </g>
    )
  }

  const target = op.t[0]
  const controls = op.c ?? []
  const label = LABEL[op.g] ?? op.g.toUpperCase()

  return (
    <g>
      {multi && <line x1={x} y1={y(lo)} x2={x} y2={y(hi)} stroke={lineColor} strokeWidth={1.4} />}
      {controls.map((q) => (
        <circle key={q} cx={x} cy={y(q)} r={4.5} fill={lineColor} />
      ))}
      {op.g === 'cx' ? (
        <g stroke={color} strokeWidth={1.6} fill={colors['lab-900']}>
          <circle cx={x} cy={y(target)} r={10} />
          <line x1={x - 10} y1={y(target)} x2={x + 10} y2={y(target)} />
          <line x1={x} y1={y(target) - 10} x2={x} y2={y(target) + 10} />
        </g>
      ) : op.g === 'cz' ? (
        <circle cx={x} cy={y(target)} r={4.5} fill={lineColor} />
      ) : (
        <g>
          <rect
            x={x - 15}
            y={y(target) - 13}
            width={30}
            height={26}
            rx={5}
            fill={colors['lab-850']}
            stroke={color}
            strokeWidth={1.2}
          />
          <text x={x} y={y(target) + 4} textAnchor="middle" fontSize={label.length > 1 ? 10 : 12} fontFamily="ui-monospace, monospace" fill={color} fontWeight={600}>
            {label}
          </text>
        </g>
      )}
    </g>
  )
}

export default function CircuitStrip({ built, step, onSeek }) {
  const colors = useThemeColors()
  const scroller = useRef(null)
  const { qubits, labels, steps } = built

  const layout = useMemo(() => {
    let x = LABEL_W + PAD_X
    return steps.map((s, i) => {
      // A global phase has no wire to sit on and no observable effect: not drawn.
      const drawn = s.gates.filter((op) => op.g !== 'gphase')
      const cols = drawn.length ? packColumns(drawn) : []
      const width = Math.max(1, cols.length) * COL
      const group = { i, x, width, cols, title: s.title }
      x += width + STEP_GAP
      return group
    })
  }, [steps])

  const totalWidth = (layout.at(-1)?.x ?? LABEL_W) + (layout.at(-1)?.width ?? 0) + PAD_X
  const height = TOP + qubits * ROW + 6
  const y = (q) => TOP + q * ROW + ROW / 2

  // Keep the step that just ran in view.
  useEffect(() => {
    const el = scroller.current
    const g = layout[Math.max(0, step - 1)]
    if (!el || !g) return
    const left = g.x - 80
    if (left < el.scrollLeft || g.x + g.width > el.scrollLeft + el.clientWidth) el.scrollTo({ left, behavior: 'smooth' })
  }, [step, layout])

  const playheadX = step === 0 ? LABEL_W + PAD_X / 2 : layout[step - 1].x + layout[step - 1].width + STEP_GAP / 2

  return (
    <div ref={scroller} className="overflow-x-auto">
      <svg width={totalWidth} height={height} className="block" role="img" aria-label="Circuit diagram">
        {Array.from({ length: qubits }, (_, q) => (
          <g key={q}>
            <text x={6} y={y(q) + 4} fontSize={11} fontFamily="ui-monospace, monospace" fill={colors['slate-400']}>
              {labels[q]}
            </text>
            <line x1={LABEL_W} y1={y(q)} x2={totalWidth - PAD_X / 2} y2={y(q)} stroke={colors['slate-600']} strokeWidth={1} />
          </g>
        ))}

        {layout.map((g) => {
          const done = g.i < step
          const current = g.i === step - 1
          return (
            <g
              key={g.i}
              onClick={() => onSeek(g.i + 1)}
              className="cursor-pointer"
              opacity={done ? 1 : 0.38}
            >
              <title>{`Step ${g.i + 1}: ${g.title}`}</title>
              <rect
                x={g.x - 4}
                y={4}
                width={g.width + 8}
                height={height - 8}
                rx={8}
                fill={current ? colors['signal-cyan'] : 'transparent'}
                fillOpacity={current ? 0.08 : 0}
                stroke={current ? colors['signal-cyan'] : colors['lab-700']}
                strokeOpacity={current ? 0.6 : 0.8}
                strokeDasharray={current ? '' : '3 3'}
              />
              <text x={g.x + g.width / 2} y={15} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill={current ? colors['signal-cyan'] : colors['slate-500']}>
                {g.i + 1}
              </text>
              {g.cols.length === 0 && (
                <text x={g.x + g.width / 2} y={y((qubits - 1) / 2) + 3} textAnchor="middle" fontSize={9} fill={colors['slate-500']}>
                  idle
                </text>
              )}
              {g.cols.map((col, ci) => col.map((op, oi) => <Gate key={`${ci}-${oi}`} op={op} x={g.x + ci * COL + COL / 2} y={y} colors={colors} />))}
            </g>
          )
        })}

        <line x1={playheadX} y1={4} x2={playheadX} y2={height - 4} stroke={colors['signal-amber']} strokeWidth={2} strokeLinecap="round" />
        <polygon points={`${playheadX - 5},2 ${playheadX + 5},2 ${playheadX},9`} fill={colors['signal-amber']} />
      </svg>
    </div>
  )
}
