import { useThemeColors } from '../../hooks/useThemeColors'

/**
 * A flat, dependency-free Bloch sphere: an orthographic projection from a fixed
 * viewpoint, drawn in SVG.
 *
 * This is the fallback for machines where WebGL is unavailable (blocklisted
 * GPUs, remote desktops, locked-down browsers). It shows the same arrow,
 * ghost and trail as the 3D sphere, just without the orbit.
 */

// Camera looking from azimuth 35° (toward +x̂, a little +ŷ), elevated 20°.
const AZ = (35 * Math.PI) / 180
const EL = (20 * Math.PI) / 180

/** Bloch (x, y, z) → screen (sx, sy) and depth (toward the viewer = positive). */
function project({ x, y, z }) {
  const right = -x * Math.sin(AZ) + y * Math.cos(AZ)
  const toward = x * Math.cos(AZ) + y * Math.sin(AZ)
  const up = z * Math.cos(EL) - toward * Math.sin(EL)
  const depth = toward * Math.cos(EL) + z * Math.sin(EL)
  return { sx: right, sy: -up, depth }
}

const ring = (fn, n = 72) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const p = project(fn((i / n) * Math.PI * 2))
    return `${i ? 'L' : 'M'}${(p.sx * 100).toFixed(2)},${(p.sy * 100).toFixed(2)}`
  }).join(' ')

const EQUATOR = ring((a) => ({ x: Math.cos(a), y: Math.sin(a), z: 0 }))
const MERIDIAN_XZ = ring((a) => ({ x: Math.cos(a), y: 0, z: Math.sin(a) }))
const MERIDIAN_YZ = ring((a) => ({ x: 0, y: Math.cos(a), z: Math.sin(a) }))

const LABELS = [
  ['|0⟩', { x: 0, y: 0, z: 1.22 }],
  ['|1⟩', { x: 0, y: 0, z: -1.24 }],
  ['|+⟩', { x: 1.3, y: 0, z: 0 }],
  ['|−⟩', { x: -1.3, y: 0, z: 0 }],
  ['|+i⟩', { x: 0, y: 1.25, z: 0 }],
  ['|−i⟩', { x: 0, y: -1.3, z: 0 }],
]

function Arrow({ v, color, opacity = 1 }) {
  const p = project(v)
  const x = p.sx * 100
  const y = p.sy * 100
  return (
    <g opacity={opacity}>
      <line x1={0} y1={0} x2={x} y2={y} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <circle cx={x} cy={y} r={p.depth >= 0 ? 6 : 4.5} fill={color} />
    </g>
  )
}

export default function BlochSphereSVG({ vector, ghost, trail, labels = true, compact = false, accent = 'signal-cyan', ghostAccent = 'signal-violet', className = '' }) {
  const colors = useThemeColors()
  const grid = colors['slate-600']
  const trailPath =
    trail && trail.length > 1
      ? trail.map((v, i) => {
          const p = project(v)
          return `${i ? 'L' : 'M'}${(p.sx * 100).toFixed(2)},${(p.sy * 100).toFixed(2)}`
        }).join(' ')
      : null

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg viewBox="-140 -135 280 270" className="h-full max-h-full w-full" role="img" aria-label="Bloch sphere">
        <circle r={100} fill={colors['signal-cyan']} fillOpacity={0.05} stroke={grid} strokeWidth={1.2} />
        <path d={EQUATOR} fill="none" stroke={grid} strokeWidth={1} />
        <path d={MERIDIAN_XZ} fill="none" stroke={grid} strokeWidth={0.6} strokeOpacity={0.5} />
        <path d={MERIDIAN_YZ} fill="none" stroke={grid} strokeWidth={0.6} strokeOpacity={0.5} />
        {[
          [{ x: 0, y: 0, z: -1.1 }, { x: 0, y: 0, z: 1.1 }],
          [{ x: -1.1, y: 0, z: 0 }, { x: 1.1, y: 0, z: 0 }],
          [{ x: 0, y: -1.1, z: 0 }, { x: 0, y: 1.1, z: 0 }],
        ].map(([a, b], i) => {
          const p = project(a)
          const q = project(b)
          return <line key={i} x1={p.sx * 100} y1={p.sy * 100} x2={q.sx * 100} y2={q.sy * 100} stroke={colors['slate-500']} strokeWidth={0.8} strokeDasharray={i ? '3 3' : ''} />
        })}
        {labels &&
          LABELS.filter(([l]) => !compact || l === '|0⟩' || l === '|1⟩').map(([label, v]) => {
            const p = project(v)
            return (
              <text key={label} x={p.sx * 100} y={p.sy * 100 + 4} textAnchor="middle" fontSize={compact ? 16 : 11} fontFamily="ui-monospace, monospace" fill={colors['slate-400']}>
                {label}
              </text>
            )
          })}
        {trailPath && <path d={trailPath} fill="none" stroke={colors[accent]} strokeWidth={2} strokeOpacity={0.45} />}
        {ghost && <Arrow v={ghost} color={colors[ghostAccent]} opacity={0.45} />}
        <Arrow v={vector} color={colors[accent]} />
        <circle r={3} fill={colors['slate-400']} />
      </svg>
    </div>
  )
}
