import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, KeyRound, Loader2, Trash2 } from 'lucide-react'

import { useCredentials } from '../hooks/useCredentials'

/**
 * Bring-your-own-key, in the dashboard rather than in a file.
 *
 * `.env` plus a restart is the right path for a server you own and a bad one
 * for someone who just opened the page. This card closes that gap: paste a key
 * and a CRN, and the poller re-authenticates on the spot.
 *
 * Two deliberate choices about honesty:
 *   - The key is never rendered back. The card shows a masked hint returned by
 *     the server, so it can confirm *which* key is loaded without holding it.
 *   - The security caveat is stated in the card, not buried in a README. A
 *     dashboard that takes someone's API key owes them that sentence.
 */
export default function CredentialsCard({ source }) {
  const { status, isSaving, error, save, clear } = useCredentials()
  const [expanded, setExpanded] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [crn, setCrn] = useState('')
  const [apiUrl, setApiUrl] = useState('')

  const isLive = source === 'live'
  const configured = status?.configured ?? false
  const fromRuntime = status?.source === 'runtime'

  async function handleSubmit(event) {
    event.preventDefault()
    const ok = await save({ apiKey, crn, apiUrl })
    if (ok) {
      // Drop the secret from component state the moment it is accepted.
      setApiKey('')
      setCrn('')
      setExpanded(false)
    }
  }

  return (
    <section className="panel">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 border-b border-lab-700/70 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60"
      >
        <KeyRound size={13} className={isLive ? 'text-signal-green' : 'text-slate-400'} />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          IBM credentials
        </span>

        {configured ? (
          <span className="flex items-center gap-1 rounded-full bg-signal-green/15 px-2 py-0.5 text-[10px] font-medium text-signal-green ring-1 ring-signal-green/25">
            <CheckCircle2 size={10} />
            {fromRuntime ? 'set in browser' : 'from .env'}
          </span>
        ) : (
          <span className="rounded-full bg-signal-amber/15 px-2 py-0.5 text-[10px] font-medium text-signal-amber ring-1 ring-signal-amber/25">
            not configured
          </span>
        )}

        {status?.api_key_hint && (
          <span className="font-mono text-[10px] text-slate-600">key {status.api_key_hint}</span>
        )}

        <ChevronDown
          size={14}
          className={`ml-auto shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <form onSubmit={handleSubmit} className="animate-fade-in space-y-3 px-4 py-3">
          <p className="text-[11px] leading-relaxed text-slate-500">
            Paste an IBM Cloud API key and your instance CRN to stream live fleet data. They are
            verified against IBM before being accepted, held <strong className="font-medium text-slate-300">in
            memory only</strong>, and never written to disk — a restart reverts to{' '}
            <code className="font-mono text-slate-400">.env</code>.
          </p>

          <div className="space-y-1">
            <label htmlFor="ibm-api-key" className="block text-[10px] uppercase tracking-wide text-slate-600">
              API key
            </label>
            <input
              id="ibm-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="paste your IBM Cloud API key"
              className="w-full rounded-md border border-lab-700 bg-lab-850 px-3 py-1.5 font-mono text-[11px] text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="ibm-crn" className="block text-[10px] uppercase tracking-wide text-slate-600">
              Service CRN
            </label>
            <input
              id="ibm-crn"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={crn}
              onChange={(event) => setCrn(event.target.value)}
              placeholder="crn:v1:bluemix:public:quantum-computing:us-east:a/…::"
              className="w-full rounded-md border border-lab-700 bg-lab-850 px-3 py-1.5 font-mono text-[11px] text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="ibm-api-url" className="block text-[10px] uppercase tracking-wide text-slate-600">
              API URL <span className="normal-case tracking-normal text-slate-700">— optional, for the EU region</span>
            </label>
            <input
              id="ibm-api-url"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={apiUrl}
              onChange={(event) => setApiUrl(event.target.value)}
              placeholder={status?.api_url || 'https://quantum.cloud.ibm.com/api/v1'}
              className="w-full rounded-md border border-lab-700 bg-lab-850 px-3 py-1.5 font-mono text-[11px] text-slate-200 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-signal-rose/30 bg-signal-rose/10 px-3 py-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-signal-rose" />
              <p className="min-w-0 break-words text-[11px] text-signal-rose">{error}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={isSaving || !apiKey.trim() || !crn.trim()}
              className="flex items-center gap-1.5 rounded-md bg-signal-cyan/15 px-3 py-1.5 text-xs font-medium text-signal-cyan ring-1 ring-signal-cyan/30 transition-colors hover:bg-signal-cyan/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
              {isSaving ? 'Verifying with IBM…' : 'Connect'}
            </button>

            {fromRuntime && (
              <button
                type="button"
                onClick={clear}
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] text-slate-500 transition-colors hover:text-signal-rose focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 disabled:opacity-40"
              >
                <Trash2 size={12} />
                Forget key
              </button>
            )}
          </div>

          <p className="border-t border-lab-700/50 pt-2.5 text-[10px] leading-relaxed text-slate-600">
            Anyone who can open this dashboard can set or replace these credentials, and on plain
            HTTP they cross the network in clear text. Fine on localhost or a trusted network — put
            authentication in front of it before exposing it publicly.
          </p>
        </form>
      )}
    </section>
  )
}
