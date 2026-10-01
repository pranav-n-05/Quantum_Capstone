import { Sun, Moon, Monitor } from 'lucide-react'

import { SYSTEM_THEME_HINT } from '../hooks/timeOfDay'
import { useTheme } from '../hooks/useTheme'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

/**
 * Segmented control for the colour theme, deliberately shaped like its
 * neighbour {@link ModeToggle} so the header reads as one instrument strip.
 *
 * It is a radiogroup rather than three buttons because the three states are
 * exclusive, which is what lets arrow keys work and what a screen reader
 * announces as "2 of 3".
 */
export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center rounded-lg border border-lab-700 bg-lab-900/80 p-1"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${label} theme`}
            title={
              value === 'system'
                ? `${SYSTEM_THEME_HINT} — currently ${resolvedTheme}`
                : `${label} theme`
            }
            onClick={() => setTheme(value)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 ${
              isActive
                ? 'bg-signal-cyan/15 text-signal-cyan'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon size={13} />
            <span className="hidden lg:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
