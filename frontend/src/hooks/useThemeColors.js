import { useMemo } from 'react'

import { useTheme } from './useTheme'

const TOKENS = [
  'lab-950',
  'lab-900',
  'lab-850',
  'lab-800',
  'lab-700',
  'lab-600',
  'slate-200',
  'slate-400',
  'slate-500',
  'slate-600',
  'signal-cyan',
  'signal-violet',
  'signal-amber',
  'signal-green',
  'signal-rose',
]

/**
 * The theme's colour tokens as `rgb()` strings, for places Tailwind cannot
 * reach -- three.js materials and SVG fills computed in JS.
 *
 * Read from the same CSS variables the utilities use, so the 3D scenes repaint
 * with everything else when the theme flips.
 */
export function useThemeColors() {
  const { resolvedTheme } = useTheme()
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement)
    return Object.fromEntries(
      TOKENS.map((name) => {
        const channels = style.getPropertyValue(`--${name}`).trim().split(/\s+/).join(', ')
        return [name, `rgb(${channels})`]
      }),
    )
    // resolvedTheme is the trigger: the variables change when it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme])
}
