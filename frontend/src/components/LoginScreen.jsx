import { useState } from 'react'
import { Atom, KeyRound, Loader2, ShieldAlert } from 'lucide-react'

/**
 * The sign-in gate.
 *
 * Shaped like the existing full-screen states (the loading spinner and the
 * "API unreachable" panel) so it reads as part of the same instrument rather
 * than a bolted-on login page.
 */
export default function LoginScreen({ onSubmit, isSubmitting, error }) {
  const [password, setPassword] = useState('')

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(password)
        }}
        className="panel w-full max-w-sm px-6 py-6"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-lab-700 bg-lab-900 p-2">
            <Atom size={18} className="text-signal-cyan" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-100">
              IBM Quantum · Live Telemetry
            </h1>
            <p className="text-[11px] text-slate-500">Sign in to continue</p>
          </div>
        </div>

        <label
          htmlFor="password"
          className="mt-5 block text-[10px] uppercase tracking-wide text-slate-600"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-md border border-lab-700 bg-lab-850 px-3 py-2 text-xs text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60"
        />

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-signal-rose/30 bg-signal-rose/10 px-3 py-2">
            <ShieldAlert size={13} className="mt-0.5 shrink-0 text-signal-rose" />
            <p className="min-w-0 break-words text-[11px] text-signal-rose">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !password}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md bg-signal-cyan/15 px-3 py-2 text-xs font-medium text-signal-cyan ring-1 ring-signal-cyan/30 transition-colors hover:bg-signal-cyan/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
          {isSubmitting ? 'Checking…' : 'Sign in'}
        </button>

        <p className="mt-4 border-t border-lab-700/50 pt-3 text-[10px] leading-relaxed text-slate-600">
          The password is set by <code className="font-mono text-slate-500">ADMIN_PASSWORD</code> on
          the server. There is no account to recover — change the environment variable and restart.
        </p>
      </form>
    </div>
  )
}
