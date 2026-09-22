import { bitstring } from '../../quantum/statevector'

/**
 * One bar per basis state: height is |amplitude|, colour is its phase.
 *
 * Colour is the point. Probability alone hides everything that makes quantum
 * algorithms work -- a sign flip in Grover's oracle or Deutsch–Jozsa's kickback
 * leaves every height unchanged and only shows up as a colour change. Phase 0
 * is cyan, phase π (a minus sign) is red, and the wheel runs through between.
 */

const HUE_AT_ZERO = 190

export const phaseColor = (radians) => {
  const deg = (radians * 180) / Math.PI
  return `hsl(${(HUE_AT_ZERO + deg + 360) % 360} 85% 55%)`
}

export function PhaseWheel({ size = 28 }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full border border-lab-700"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(from 90deg, ${Array.from({ length: 13 }, (_, i) => phaseColor((i / 12) * 2 * Math.PI)).join(', ')})`,
      }}
      title="Phase wheel: cyan = 0, red = π (a minus sign)"
    />
  )
}

export default function AmplitudeBars({ state }) {
  const { n, re, im } = state
  const count = re.length
  const showPercent = count <= 16

  return (
    <div>
      <div className="flex h-44 items-end gap-1">
        {Array.from({ length: count }, (_, i) => {
          const mag = Math.hypot(re[i], im[i])
          const prob = mag * mag
          const visible = mag > 1e-6
          const phase = Math.atan2(im[i], re[i])
          return (
            <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`|${bitstring(i, n)}⟩  amplitude ${mag.toFixed(3)} ∠ ${((phase * 180) / Math.PI).toFixed(0)}°  ·  P = ${(prob * 100).toFixed(1)}%`}>
              {showPercent && (
                <span className={`mb-0.5 font-mono text-[9px] ${visible ? 'text-slate-400' : 'text-transparent'}`}>
                  {(prob * 100).toFixed(prob > 0.0995 ? 0 : 1)}%
                </span>
              )}
              <div
                className="w-full rounded-t-sm transition-[height,background-color] duration-500 ease-out"
                style={{
                  height: `${mag * 100}%`,
                  background: visible ? phaseColor(phase) : 'transparent',
                  boxShadow: visible ? `0 0 12px -2px ${phaseColor(phase)}` : 'none',
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex gap-1 border-t border-lab-700 pt-1">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={`min-w-0 flex-1 text-center font-mono ${count > 16 ? 'text-[7px]' : 'text-[10px]'} text-slate-500`}>
            {bitstring(i, n)}
          </span>
        ))}
      </div>
    </div>
  )
}
