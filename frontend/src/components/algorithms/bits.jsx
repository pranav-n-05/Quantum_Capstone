/** Small labels shared by the entry header and its overview. */

export function Cost({ value, label, tone }) {
  const zero = value === 0
  return (
    <div className={`rounded-lg py-2 ${tone === 'violet' ? 'bg-signal-violet/10' : 'bg-lab-850'}`}>
      <p className={`font-mono text-lg ${zero ? 'text-slate-600' : tone === 'violet' ? 'text-signal-violet' : 'text-slate-300'}`}>{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  )
}

export function Badge({ children, tone = 'cyan' }) {
  const styles = {
    cyan: 'border-signal-cyan/30 text-signal-cyan',
    violet: 'border-signal-violet/30 text-signal-violet',
    green: 'border-signal-green/30 text-signal-green',
    amber: 'border-signal-amber/30 text-signal-amber',
    slate: 'border-lab-600 text-slate-400',
  }
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[tone]}`}>{children}</span>
}
