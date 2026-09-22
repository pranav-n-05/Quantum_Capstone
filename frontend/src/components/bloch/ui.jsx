/**
 * Small shared pieces for the Bloch Lab and algorithm debugger, styled to
 * match the dashboard's instrument panels.
 */

export const DEG = Math.PI / 180

export const fmt = (x, digits = 3) => {
  const v = Math.abs(x) < 10 ** -digits / 2 ? 0 : x
  return v.toFixed(digits).replace('-', '−')
}

export const fmtDeg = (radians) => `${fmt(radians / DEG, 1)}°`

export function Panel({ title, icon: Icon, actions, children, className = '', bodyClassName = 'p-4' }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-heading justify-between">
        <span className="flex items-center gap-2">
          {Icon && <Icon size={13} className="text-signal-cyan" />}
          {title}
        </span>
        {actions && <span className="flex items-center gap-1 normal-case tracking-normal">{actions}</span>}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function Slider({ label, value, min, max, step = 1, onChange, unit = '°', disabled = false }) {
  return (
    <label className={`block ${disabled ? 'opacity-40' : ''}`}>
      <span className="flex items-center justify-between text-[11px] text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-300">
          {Number(value).toFixed(step < 1 ? 2 : 0)}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[rgb(var(--signal-cyan))]"
      />
    </label>
  )
}

export function Tabs({ tabs, value, onChange, size = 'sm' }) {
  return (
    <div role="tablist" className="inline-flex flex-wrap rounded-lg border border-lab-700 bg-lab-900/80 p-0.5">
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`rounded-md px-2.5 ${size === 'sm' ? 'py-1 text-[11px]' : 'py-1.5 text-xs'} font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 ${
              active ? 'bg-signal-cyan/15 text-signal-cyan' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function Button({ children, onClick, disabled, variant = 'ghost', title, className = '', type = 'button' }) {
  const styles = {
    primary: 'border-signal-cyan/40 bg-signal-cyan/15 text-signal-cyan hover:bg-signal-cyan/25',
    ghost: 'border-lab-700 bg-lab-900/80 text-slate-400 hover:text-slate-200',
    violet: 'border-signal-violet/40 bg-signal-violet/15 text-signal-violet hover:bg-signal-violet/25',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

/** A thin horizontal meter, 0–1. */
export function Meter({ value, tone = 'cyan', label, detail }) {
  const color = { cyan: 'bg-signal-cyan', violet: 'bg-signal-violet', green: 'bg-signal-green', amber: 'bg-signal-amber' }[tone]
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>{label}</span>
          <span className="font-mono text-slate-300">{detail ?? `${(value * 100).toFixed(1)}%`}</span>
        </div>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-lab-800">
        <div className={`h-full rounded-full ${color} transition-[width] duration-300`} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
      </div>
    </div>
  )
}
