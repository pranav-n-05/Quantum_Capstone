import { useMemo, useState } from 'react'
import { Binary, ChevronLeft, LayoutList, Network, Search, Table2 } from 'lucide-react'

import DirectoryTable from './DirectoryTable'
import EntryView from './EntryView'
import { ALGORITHMS, defaultParams, GROUPS, TRACK_ORDER, TRACKS } from './library'
import TrackChooser from './TrackChooser'

const ICONS = { protocol: Network, algorithm: Binary }

const haystack = (a) => [a.name, a.category, a.summary, ...Object.values(a.dir)].join(' ').toLowerCase()

/**
 * The library: pick a track, then browse it as a grouped list (Explore) or as
 * the course directory's table (Directory).
 *
 * The chosen track, the selection within each track, every entry's knob
 * settings and the open tab all survive switching around, so moving between
 * protocols and algorithms and back lands exactly where you left.
 */
export default function LibraryView() {
  const [track, setTrack] = useState(null)
  const [mode, setMode] = useState('explore')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('overview')
  const [selectedByTrack, setSelectedByTrack] = useState(() => Object.fromEntries(TRACK_ORDER.map((t) => [t, TRACKS[t].items[0].id])))
  const [paramsById, setParamsById] = useState(() => Object.fromEntries(ALGORITHMS.map((a) => [a.id, defaultParams(a)])))

  const items = track ? TRACKS[track].items : []
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter((a) => haystack(a).includes(q)) : items
  }, [items, query])

  if (!track) return <TrackChooser onPick={(t) => (setTrack(t), setQuery(''))} />

  const { label, tagline } = TRACKS[track]
  const selectedId = selectedByTrack[track]
  const entry = items.find((a) => a.id === selectedId)
  const open = (id) => {
    setSelectedByTrack((all) => ({ ...all, [track]: id }))
    setMode('explore')
  }
  const number = (id) => items.findIndex((a) => a.id === id) + 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setTrack(null)}
          className="flex items-center gap-1 rounded-lg border border-lab-700 bg-lab-900/80 px-2 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60"
        >
          <ChevronLeft size={13} />
          Library
        </button>

        <Segmented
          label="Track"
          value={track}
          onChange={(t) => (setTrack(t), setQuery(''))}
          options={TRACK_ORDER.map((id) => ({ value: id, label: `${TRACKS[id].label} (${TRACKS[id].items.length})`, icon: ICONS[id] }))}
        />

        <Segmented
          label="View"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'explore', label: 'Explore', icon: LayoutList },
            { value: 'directory', label: 'Directory table', icon: Table2 },
          ]}
        />

        <p className="text-[11px] uppercase tracking-wider text-slate-500">{tagline}</p>
      </div>

      {mode === 'directory' ? (
        <div className="space-y-3">
          <SearchBox query={query} onQuery={setQuery} placeholder={`Filter ${filtered.length} ${label.toLowerCase()}…`} />
          <DirectoryTable track={track} items={filtered} onOpen={open} />
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label={label} className="min-w-0 lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
            <SearchBox query={query} onQuery={setQuery} placeholder={`Search ${label.toLowerCase()}…`} />
            {filtered.length === 0 && <p className="px-1 py-3 text-xs text-slate-500">Nothing matches “{query}”.</p>}
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-3 lg:overflow-visible">
              {GROUPS[track].map((g) => {
                const inGroup = filtered.filter((a) => a.group === g.id)
                if (!inGroup.length) return null
                return (
                  <div key={g.id} className="flex shrink-0 gap-2 lg:block">
                    <p className="hidden px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 lg:block">{g.label}</p>
                    <ol className="flex gap-2 lg:block lg:space-y-1.5">
                      {inGroup.map((a) => {
                        const active = a.id === selectedId
                        return (
                          <li key={a.id} className="shrink-0">
                            <button
                              type="button"
                              onClick={() => open(a.id)}
                              aria-current={active ? 'true' : undefined}
                              className={`w-52 rounded-xl border px-3 py-2 text-left transition-colors lg:w-full ${
                                active ? 'border-signal-cyan/50 bg-signal-cyan/10' : 'border-lab-700/70 bg-lab-900/60 hover:border-lab-600'
                              }`}
                            >
                              <span className="flex items-baseline gap-2">
                                <span className="font-mono text-[10px] text-slate-600">{String(number(a.id)).padStart(2, '0')}</span>
                                <span className={`text-[13px] font-medium leading-snug ${active ? 'text-signal-cyan' : 'text-slate-200'}`}>{a.name}</span>
                              </span>
                              <span className="mt-0.5 block pl-6 text-[10px] text-slate-500">
                                {a.level} · {a.speedup}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                )
              })}
            </div>
          </nav>

          <EntryView
            key={entry.id}
            entry={entry}
            params={paramsById[selectedId]}
            onParamChange={(key, value) => setParamsById((all) => ({ ...all, [selectedId]: { ...all[selectedId], [key]: value } }))}
            tab={tab}
            onTab={setTab}
          />
        </div>
      )}
    </div>
  )
}

function Segmented({ label, value, onChange, options }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap items-center rounded-lg border border-lab-700 bg-lab-900/80 p-1">
      {options.map(({ value: v, label: l, icon: Icon }) => {
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={l}
            onClick={() => onChange(v)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 ${
              active ? 'bg-signal-cyan/15 text-signal-cyan' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon size={13} />
            {l}
          </button>
        )
      })}
    </div>
  )
}

function SearchBox({ query, onQuery, placeholder }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-lab-700 bg-lab-900/80 px-2.5 py-1.5 focus-within:border-signal-cyan/50">
      <Search size={13} className="text-slate-500" />
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
      />
    </label>
  )
}
