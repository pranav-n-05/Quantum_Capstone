import { useEffect, useRef } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useThemeColors } from '../../../hooks/useThemeColors'

/**
 * Shared pieces for the interactive labs: themed charts on recharts (already
 * in the bundle for the dashboard), a canvas heatmap, stat tiles and a
 * reproducible-run control. Every lab draws with these so forty pages read as
 * one instrument panel.
 */

export const useLabColors = useThemeColors

export const SERIES = ['signal-cyan', 'signal-violet', 'signal-amber', 'signal-green', 'signal-rose']

const tooltipStyle = (c) => ({
  contentStyle: { background: c['lab-850'], border: `1px solid ${c['lab-700']}`, borderRadius: 8, fontSize: 11 },
  labelStyle: { color: c['slate-400'] },
  itemStyle: { padding: '1px 0' },
})

/** Powers of ten spanning [lo, hi] -- recharts' own log ticks repeat labels. */
function decadeTicks(lo, hi) {
  if (!(lo > 0) || !(hi > 0)) return undefined
  const out = []
  for (let k = Math.floor(Math.log10(lo)); k <= Math.ceil(Math.log10(hi)); k++) out.push(10 ** k)
  return out
}

const extent = (data, keys) => {
  const vals = data.flatMap((d) => keys.map((k) => d[k])).filter((v) => typeof v === 'number' && v > 0)
  return vals.length ? [Math.min(...vals), Math.max(...vals)] : [1, 10]
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }
const superscript = (n) => String(n).split('').map((ch) => SUP[ch]).join('')

const fmtTick = (v) => {
  if (typeof v !== 'number') return v
  if (v !== 0 && (Math.abs(v) >= 1e4 || Math.abs(v) < 0.01)) {
    const k = Math.log10(Math.abs(v))
    return Number.isInteger(Math.round(k * 1e6) / 1e6) ? `10${superscript(Math.round(k))}` : v.toExponential(1)
  }
  return +v.toFixed(3)
}

export function LineChartBox({ data, x, series, xLabel, yLabel, height = 220, xLog, yLog, yDomain, refLines = [], dots = [] }) {
  const c = useLabColors()
  const xTicks = xLog ? decadeTicks(...extent(data, [x])) : undefined
  const yExt = yDomain && typeof yDomain[0] === 'number' ? yDomain : extent(data, series.map((s) => s.key))
  const yTicks = yLog ? decadeTicks(...yExt) : undefined
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 12, bottom: xLabel ? 16 : 0, left: yLabel ? 4 : -14 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={c['lab-700']} />
          <XAxis
            dataKey={x}
            type="number"
            scale={xLog ? 'log' : 'auto'}
            domain={xLog ? ['dataMin', 'dataMax'] : ['auto', 'auto']}
            ticks={xTicks}
            stroke={c['slate-500']}
            tick={{ fontSize: 10 }}
            tickFormatter={fmtTick}
            label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -10, fontSize: 10, fill: c['slate-500'] } : undefined}
            allowDataOverflow
          />
          <YAxis
            stroke={c['slate-500']}
            tick={{ fontSize: 10 }}
            tickFormatter={fmtTick}
            scale={yLog ? 'log' : 'auto'}
            domain={yDomain ?? (yLog ? yExt : ['auto', 'auto'])}
            ticks={yTicks}
            allowDataOverflow
            width={yLabel ? 56 : 46}
            label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fontSize: 10, fill: c['slate-500'], dy: 40 } : undefined}
          />
          <Tooltip {...tooltipStyle(c)} formatter={(v) => (typeof v === 'number' ? fmtTick(v) : v)} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: xLabel ? 14 : 4 }} iconType="plainline" iconSize={14} />
          {refLines.map((r, i) => (
            <ReferenceLine key={`ref${i}`} {...(r.y !== undefined ? { y: r.y } : { x: r.x })} stroke={c[r.color ?? 'slate-500']} strokeDasharray="4 4" label={{ value: r.label, fontSize: 9, fill: c[r.color ?? 'slate-500'], position: r.position ?? 'insideTopRight' }} />
          ))}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type={s.step ? 'stepAfter' : 'monotone'}
              dataKey={s.key}
              name={s.label}
              stroke={c[s.color ?? SERIES[i % SERIES.length]]}
              strokeWidth={s.width ?? 1.8}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              dot={s.dots ? { r: 2.5 } : false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
          {dots.map((d, i) => (
            <ReferenceDot key={`dot${i}`} x={d.x} y={d.y} r={4} fill={c[d.color ?? 'signal-amber']} stroke="none" />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BarChartBox({ data, x, series, height = 200, yDomain, xLabel, angled = false }) {
  const c = useLabColors()
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: angled ? 24 : xLabel ? 14 : 0, left: -14 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={c['lab-700']} vertical={false} />
          <XAxis
            dataKey={x}
            stroke={c['slate-500']}
            tick={{ fontSize: 9, ...(angled ? { angle: -45, textAnchor: 'end' } : {}) }}
            interval={0}
            label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -8, fontSize: 10, fill: c['slate-500'] } : undefined}
          />
          <YAxis stroke={c['slate-500']} tick={{ fontSize: 10 }} tickFormatter={fmtTick} domain={yDomain ?? [0, 'auto']} />
          <Tooltip {...tooltipStyle(c)} formatter={(v) => fmtTick(v)} cursor={{ fill: c['lab-800'] }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 10, paddingTop: angled ? 20 : 4 }} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={c[s.color ?? SERIES[i % SERIES.length]]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ScatterBox({ groups, height = 240, xDomain, yDomain, xLabel, yLabel, square = false }) {
  const c = useLabColors()
  return (
    <div style={{ height }} className={`w-full ${square ? 'mx-auto max-w-[320px]' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 6, right: 10, bottom: xLabel ? 16 : 0, left: -14 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={c['lab-700']} />
          <XAxis type="number" dataKey="x" domain={xDomain ?? ['auto', 'auto']} stroke={c['slate-500']} tick={{ fontSize: 10 }} tickFormatter={fmtTick} label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -10, fontSize: 10, fill: c['slate-500'] } : undefined} />
          <YAxis type="number" dataKey="y" domain={yDomain ?? ['auto', 'auto']} stroke={c['slate-500']} tick={{ fontSize: 10 }} tickFormatter={fmtTick} label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fontSize: 10, fill: c['slate-500'], dy: 30 } : undefined} />
          <Tooltip {...tooltipStyle(c)} formatter={(v) => fmtTick(v)} />
          {groups.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} />}
          {groups.map((g, i) => (
            <Scatter key={g.label} name={g.label} data={g.points} fill={c[g.color ?? SERIES[i % SERIES.length]]} shape={g.shape ?? 'circle'} isAnimationActive={false} line={g.line ? { stroke: c[g.color ?? SERIES[i]], strokeWidth: 2 } : false} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * values[r][c] painted from lab-900 (low) to `hot` (high). Click reports the
 * cell; `marker` draws a crosshair at a cell.
 */
export function Heatmap({ values, min, max, hot = 'signal-cyan', marker, onPick, height = 200, title }) {
  const ref = useRef(null)
  const c = useLabColors()
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rows = values.length
    const cols = values[0].length
    const { width: W, height: H } = canvas
    const lo = min ?? Math.min(...values.flat())
    const hi = max ?? Math.max(...values.flat())
    const h = c[hot].match(/\d+/g).map(Number)
    const z = c['lab-900'].match(/\d+/g).map(Number)
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < cols; k++) {
        const t = hi > lo ? (values[r][k] - lo) / (hi - lo) : 0
        const mix = (i) => Math.round(z[i] + (h[i] - z[i]) * Math.max(0, Math.min(1, t)))
        ctx.fillStyle = `rgb(${mix(0)},${mix(1)},${mix(2)})`
        ctx.fillRect(Math.floor((k * W) / cols), Math.floor((r * H) / rows), Math.ceil(W / cols) + 1, Math.ceil(H / rows) + 1)
      }
    if (marker) {
      const mx = ((marker.c + 0.5) * W) / cols
      const my = ((marker.r + 0.5) * H) / rows
      ctx.strokeStyle = c['signal-amber']
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(mx, my, 6, 0, 2 * Math.PI)
      ctx.stroke()
    }
  }, [values, min, max, hot, marker, c])

  return (
    <canvas
      ref={ref}
      width={480}
      height={240}
      title={title}
      onClick={(e) => {
        if (!onPick) return
        const box = e.currentTarget.getBoundingClientRect()
        const cols = values[0].length
        const rows = values.length
        onPick(Math.min(rows - 1, Math.floor(((e.clientY - box.top) / box.height) * rows)), Math.min(cols - 1, Math.floor(((e.clientX - box.left) / box.width) * cols)))
      }}
      style={{ height }}
      className={`w-full rounded-md border border-lab-700 ${onPick ? 'cursor-crosshair' : ''}`}
    />
  )
}

export function Stat({ label, value, tone = 'slate', hint }) {
  const color = { slate: 'text-slate-200', cyan: 'text-signal-cyan', violet: 'text-signal-violet', amber: 'text-signal-amber', green: 'text-signal-green', rose: 'text-signal-rose' }[tone]
  return (
    <div className="rounded-lg bg-lab-850 px-3 py-2" title={hint}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`font-mono text-base ${color}`}>{value}</p>
    </div>
  )
}

export function Stats({ children }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>
}

export function Note({ children, tone = 'slate' }) {
  const style = {
    slate: 'border-lab-700 text-slate-400',
    green: 'border-signal-green/30 bg-signal-green/5 text-signal-green',
    rose: 'border-signal-rose/30 bg-signal-rose/5 text-signal-rose',
    amber: 'border-signal-amber/30 bg-signal-amber/5 text-signal-amber',
  }[tone]
  return <p className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${style}`}>{children}</p>
}

export function LabSection({ title, children, aside }) {
  return (
    <section className="rounded-xl border border-lab-700/70 bg-lab-900/40 p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</h4>
        {aside}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

/** "Run again" with a new random seed -- results stay reproducible per seed. */
export function SeedControl({ seed, onSeed }) {
  return (
    <span className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
      seed {seed}
      <button type="button" onClick={() => onSeed(seed + 1)} className="rounded-md border border-lab-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-signal-cyan/50 hover:text-signal-cyan">
        Run again
      </button>
    </span>
  )
}

export const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`
