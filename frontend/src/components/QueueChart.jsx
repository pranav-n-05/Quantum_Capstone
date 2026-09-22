import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TrendingUp } from 'lucide-react'

import { useTheme } from '../hooks/useTheme'

// Each series also carries a distinct dash pattern, so the chart stays
// readable for viewers who cannot separate these by hue.
const DASHES = ['0', '6 3', '2 3', '8 3 2 3', '4 4']

// Recharts renders to SVG attributes rather than classes, so it cannot pick up
// the CSS variables the rest of the dashboard themes through -- these two
// palettes are the same tokens, resolved in JS. The light series colours are
// darkened: the dark palette's neons vanish against white.
const CHART_THEME = {
  dark: {
    grid: '#1e293f',
    axis: '#475569',
    surface: '#0a0e1a',
    label: '#e2e8f0',
    series: ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'],
  },
  light: {
    grid: '#dbe3ee',
    axis: '#64748b',
    surface: '#ffffff',
    label: '#1b2434',
    series: ['#0885a3', '#6d28d9', '#047857', '#b45309', '#d61942'],
  },
}

const formatClock = (ms) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function QueueChart({ chartData, backends }) {
  const { resolvedTheme } = useTheme()
  const palette = CHART_THEME[resolvedTheme] ?? CHART_THEME.dark

  // Plot the five busiest operational machines. Eighteen lines is not a chart,
  // it is a plate of spaghetti.
  const tracked = useMemo(
    () =>
      backends
        .filter((b) => !b.is_simulator && b.is_operational)
        .sort((a, b) => b.queue_length - a.queue_length)
        .slice(0, 5)
        .map((b) => b.name),
    [backends],
  )

  const hasData = chartData.length >= 2

  return (
    <section className="panel flex h-full flex-col">
      <h2 className="panel-heading">
        <TrendingUp size={13} className="text-signal-violet" />
        Queue depth · five busiest QPUs
        <span className="ml-auto normal-case tracking-normal text-slate-600">
          {chartData.length} samples
        </span>
      </h2>

      <div className="min-h-[260px] flex-1 px-2 py-3">
        {!hasData ? (
          <div className="flex h-full min-h-[240px] items-center justify-center text-xs text-slate-600">
            Collecting samples…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={palette.grid} vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatClock}
                stroke={palette.axis}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: palette.grid }}
                minTickGap={44}
              />
              <YAxis
                stroke={palette.axis}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={46}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: palette.surface,
                  border: `1px solid ${palette.grid}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: palette.label }}
                labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                itemStyle={{ padding: '1px 0' }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10, paddingTop: 6 }}
                iconType="plainline"
                iconSize={14}
              />
              {tracked.map((name, index) => {
                const colour = palette.series[index % palette.series.length]
                const dash = DASHES[index % DASHES.length]
                return (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={colour}
                    strokeWidth={1.6}
                    strokeDasharray={dash}
                    dot={false}
                    // Values are missing for ticks predating a backend appearing;
                    // bridge them rather than breaking the line into fragments.
                    connectNulls
                    isAnimationActive={false}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
