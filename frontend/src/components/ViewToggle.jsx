import { Gauge, CircuitBoard, Orbit, Library } from 'lucide-react'

const OPTIONS = [
  { value: 'dashboard', label: 'Dashboard', icon: Gauge, title: 'Live fleet telemetry' },
  { value: 'playground', label: 'Playground', icon: CircuitBoard, title: 'Build and run a circuit' },
  { value: 'bloch', label: 'Bloch Lab', icon: Orbit, title: 'Explore a single qubit on the Bloch sphere' },
  { value: 'library', label: 'Library', icon: Library, title: 'Quantum protocols and algorithms, step by step' },
]

/**
 * Switches between the app's views.
 *
 * Shaped like {@link ThemeToggle} and {@link ModeToggle} on purpose -- the
 * header is one instrument strip and a third control with its own styling
 * would read as something bolted on.
 *
 * This is a radiogroup rather than a router because nothing here needs a
 * deep link, and react-router would be the first runtime dependency this
 * project has ever added.
 */
export default function ViewToggle({ view, onViewChange }) {
  return (
    <div
      role="radiogroup"
      aria-label="View"
      className="inline-flex items-center rounded-lg border border-lab-700 bg-lab-900/80 p-1"
    >
      {OPTIONS.map(({ value, label, icon: Icon, title }) => {
        const isActive = view === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={title}
            onClick={() => onViewChange(value)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 ${
              isActive ? 'bg-signal-cyan/15 text-signal-cyan' : 'text-slate-500 hover:text-slate-300'
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
