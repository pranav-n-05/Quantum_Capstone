import {
  BarChart,
  Bar,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, BarChart3, Cpu, Sigma } from 'lucide-react'

import { useTheme } from '../../hooks/useTheme'

/**
 * Measurement counts.
 *
 * Recharts renders SVG attributes and cannot read the CSS custom properties the
 * rest of the app themes with, so the palette is duplicated here in JS and
 * selected by `resolvedTheme` -- the same accommodation QueueChart makes.
 *
 * The engine badge is not decoration. A noisy result and an ideal one look
 * alike at a glance, and mistaking one for the other is exactly the confusion
 * this dashboard exists to prevent.
 */
const CHART_THEME = {
  dark: {
    grid: '#1e293f',
    axis: '#475569',
    surface: '#0a0e1a',
    label: '#e2e8f0',
    value: '#94a3b8',
    bar: '#22d3ee',
    barMuted: '#a78bfa',
  },
  light: {
    grid: '#dbe3ee',
    axis: '#64748b',
    surface: '#ffffff',
    label: '#1b2434',
    value: '#475569',
    bar: '#0885a3',
    barMuted: '#6d28d9',
  },
}

const ENGINE_BADGE = {
  noisy: {
    label: 'QPU noise model',
    icon: Cpu,
    className: 'bg-signal-violet/15 text-signal-violet ring-signal-violet/25',
    title: 'Aer with a superconducting-QPU noise model — what hardware would return',
  },
  ideal: {
    label: 'Ideal (Aer)',
    icon: Activity,
    className: 'bg-signal-cyan/15 text-signal-cyan ring-signal-cyan/25',
    title: 'Aer with no noise — textbook probabilities plus shot noise',
  },
  exact: {
    label: 'Exact',
    icon: Sigma,
    className: 'bg-signal-green/15 text-signal-green ring-signal-green/25',
    title: 'The dependency-free statevector simulator — exact amplitudes',
  },
}

function badgeFor(result) {
  if (result.noisy) return ENGINE_BADGE.noisy
  return result.engine === 'exact' ? ENGINE_BADGE.exact : ENGINE_BADGE.ideal
}

/**
 * A hand-written tooltip.
 *
 * Recharts' default pairs a series `name` with the value, which for a
 * single-series histogram renders as "00count : 511" -- the bitstring label
 * running straight into the word "count". Supplying `content` sidesteps the
 * name/value formatting entirely.
 */
function CountTooltip({ active, payload, palette, shots }) {
  if (!active || !payload?.length) return null
  const { bitstring, count } = payload[0].payload
  const percent = ((count / shots) * 100).toFixed(1)

  return (
    <div
      className="rounded-lg px-3 py-2 text-[11px] shadow-lg"
      style={{ background: palette.surface, border: `1px solid ${palette.grid}` }}
    >
      <div className="font-mono text-xs" style={{ color: palette.label }}>
        |{bitstring}⟩
      </div>
      <div className="mt-1 font-mono tabular-nums" style={{ color: palette.value }}>
        {count.toLocaleString()} / {shots.toLocaleString()} shots
      </div>
      <div className="font-mono tabular-nums" style={{ color: palette.value }}>
        {percent}%
      </div>
    </div>
  )
}

export default function ResultsHistogram({ result, isRunning }) {
  const { resolvedTheme } = useTheme()
  const palette = CHART_THEME[resolvedTheme] ?? CHART_THEME.dark

  if (!result) {
    return (
      <section className="panel">
        <h2 className="panel-heading">
          <BarChart3 size={13} />
          Results
        </h2>
        <div className="flex items-center justify-center px-4 py-10 text-center text-xs text-slate-500">
          {isRunning ? 'Running…' : 'Run the circuit to see measurement counts.'}
        </div>
      </section>
    )
  }

  // Sort here rather than trusting the object's key order. JavaScript hoists
  // keys that look like array indices ("11") ahead of ones that do not ("00"),
  // so a backend that sorted these correctly still arrives scrambled.
  const data = Object.entries(result.counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bitstring, count]) => ({ bitstring, count }))

  // Past a certain width the labels stop being readable and the chart is
  // better off without them.
  const showTicks = data.length <= 16
  const showValues = data.length <= 10
  const badge = badgeFor(result)
  const BadgeIcon = badge.icon

  const peak = Math.max(...data.map((entry) => entry.count))

  return (
    <section className="panel">
      <h2 className="panel-heading">
        <BarChart3 size={13} />
        Results
        <span
          title={badge.title}
          className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal ring-1 ${badge.className}`}
        >
          <BadgeIcon size={10} />
          {badge.label}
        </span>
      </h2>

      {result.degraded_reason && (
        <p className="border-b border-signal-amber/25 bg-signal-amber/10 px-4 py-2 text-[11px] text-signal-amber">
          {result.degraded_reason}
        </p>
      )}

      {/* An explicit height, not flex-1: this panel sits in a free-flowing
          column, and a percentage-height ResponsiveContainer with no bounded
          parent grows without limit rather than collapsing. */}
      <div className="h-[280px] px-2 py-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 10, bottom: 4, left: -14 }}>
            <CartesianGrid stroke={palette.grid} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="bitstring"
              tick={
                showTicks
                  ? { fill: palette.axis, fontSize: 10, fontFamily: 'ui-monospace' }
                  : false
              }
              tickLine={false}
              axisLine={{ stroke: palette.grid }}
              interval={0}
              angle={data.length > 8 ? -45 : 0}
              textAnchor={data.length > 8 ? 'end' : 'middle'}
              height={data.length > 8 ? 48 : 22}
            />
            <YAxis
              tick={{ fill: palette.axis, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
              // Headroom so the value labels above the tallest bar are not clipped.
              domain={[0, Math.ceil(peak * 1.15)]}
            />
            <Tooltip
              cursor={{ fill: palette.grid, opacity: 0.35 }}
              content={<CountTooltip palette={palette} shots={result.shots} />}
            />
            <Bar
              dataKey="count"
              isAnimationActive={false}
              radius={[3, 3, 0, 0]}
              fill={result.noisy ? palette.barMuted : palette.bar}
              maxBarSize={72}
            >
              {showValues && (
                <LabelList
                  dataKey="count"
                  position="top"
                  offset={6}
                  style={{
                    fill: palette.value,
                    fontSize: 10,
                    fontFamily: 'ui-monospace',
                  }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-lab-700/50 px-4 py-2 text-[10px] text-slate-600">
        <span>
          <span className="font-mono tabular-nums text-slate-400">
            {result.shots.toLocaleString()}
          </span>{' '}
          shots
        </span>
        <span>
          <span className="font-mono tabular-nums text-slate-400">{data.length}</span> distinct
          outcome{data.length === 1 ? '' : 's'}
        </span>
        {result.duration_ms != null && (
          <span>
            <span className="font-mono tabular-nums text-slate-400">{result.duration_ms}</span> ms
          </span>
        )}
        <span className="ml-auto">qubit 0 is the rightmost bit</span>
      </div>
    </section>
  )
}
