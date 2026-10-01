import { Box, FlaskConical } from 'lucide-react'

import { COLUMNS, GROUPS } from './library'

/**
 * The whole track as one table, with the course directory's own columns --
 * the view to hand a professor. Clicking a row opens that entry.
 */
export default function DirectoryTable({ track, items, onOpen }) {
  const groupLabel = Object.fromEntries(GROUPS[track].map((g) => [g.id, g.label]))
  return (
    <section className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="bg-lab-850 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">{track === 'algorithm' ? 'Algorithm' : 'Protocol Name'}</th>
              {COLUMNS[track].map((c) => (
                <th key={c.key} className="px-3 py-2 font-semibold">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 font-semibold">Here</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a, i) => (
              <tr key={a.id} onClick={() => onOpen(a.id)} className="cursor-pointer border-t border-lab-700/60 align-top hover:bg-signal-cyan/5">
                <td className="px-3 py-2 font-mono text-[10px] text-slate-600">{String(i + 1).padStart(2, '0')}</td>
                <td className="px-3 py-2">
                  <span className="font-medium text-signal-cyan">{a.name}</span>
                  <span className="block text-[10px] text-slate-500">{groupLabel[a.group]}</span>
                </td>
                {COLUMNS[track].map((c) => (
                  <td key={c.key} className="px-3 py-2 text-slate-300">
                    {a.dir[c.key]}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <span className="flex gap-1.5 text-slate-500">
                    {a.lab && <FlaskConical size={13} className="text-signal-amber" aria-label="interactive lab" />}
                    {a.build && <Box size={13} className="text-signal-cyan" aria-label="circuit debugger" />}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-lab-700/60 px-3 py-2 text-[10px] text-slate-500">
        <FlaskConical size={11} className="inline text-signal-amber" /> interactive lab · <Box size={11} className="inline text-signal-cyan" /> gate-by-gate circuit. Click any row to open it.
      </p>
    </section>
  )
}
