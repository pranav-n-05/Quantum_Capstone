import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Atom, AlertTriangle, X, FlaskConical, LogOut, WifiOff } from 'lucide-react'

import { useQuantumTelemetry } from './hooks/useQuantumTelemetry'
import { useAuth } from './hooks/useAuth'
import LoginScreen from './components/LoginScreen'
import FleetSummary from './components/FleetSummary'
import JobStream from './components/JobStream'
import ModeToggle from './components/ModeToggle'
import QPUCard from './components/QPUCard'
import QueueChart from './components/QueueChart'
import Recommender from './components/Recommender'
import ThemeToggle from './components/ThemeToggle'
import ViewToggle from './components/ViewToggle'
import CredentialsCard from './components/CredentialsCard'
import Playground from './components/playground/Playground'
import ErrorBoundary from './components/ErrorBoundary'

// three.js is only needed by these two views, so they load on first visit
// and the dashboard's own bundle stays as small as it was.
const BlochLab = lazy(() => import('./components/bloch/BlochLab'))
const AlgorithmsView = lazy(() => import('./components/algorithms/AlgorithmsView'))

const SUBTITLES = {
  playground: 'Build a circuit and run it through a QPU noise model',
  bloch: 'One qubit, every gate as a rotation — measure it, let it decohere, solve challenges',
  algorithms: 'Eight algorithms as a step-through debugger — watch amplitudes, phases and entanglement change',
}

function Dashboard({ authEnabled, onSignOut, onAuthLost }) {
  const { snapshot, chartData, connectionState, error, isLoading } = useQuantumTelemetry()
  const [dismissedReason, setDismissedReason] = useState(null)
  const [view, setView] = useState('dashboard')

  const degradedReason = snapshot?.degraded_reason ?? null

  // Re-raise the toast when the *reason* changes, even if the user dismissed a
  // previous one -- a new failure is new information.
  useEffect(() => {
    if (degradedReason && degradedReason !== dismissedReason) setDismissedReason(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [degradedReason])

  useEffect(() => {
    if (error) onAuthLost?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  const showDegradedToast = Boolean(degradedReason) && degradedReason !== dismissedReason

  const recommendedNames = useMemo(
    () => new Set((snapshot?.recommendations ?? []).map((r) => r.backend_name)),
    [snapshot],
  )

  const { backends = [], jobs = [], summary, recommendations = [], source } = snapshot ?? {}

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* ---------------------------------------------------------------- */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-lab-700 bg-lab-900 p-2">
              <Atom size={18} className="text-signal-cyan" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-100">
                IBM Quantum · Live Telemetry
              </h1>
              <p className="text-[11px] text-slate-500">
                {SUBTITLES[view] ??
                  `Fleet queue depth, device status and job flow, refreshed every ${
                    snapshot?.poll_interval_seconds ?? 12
                  }s`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle view={view} onViewChange={setView} />
            <ThemeToggle />
            <ModeToggle source={source} connectionState={connectionState} />
            {authEnabled && (
              <button
                type="button"
                onClick={onSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="flex items-center gap-1.5 rounded-lg border border-lab-700 bg-lab-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal-cyan/60"
              >
                <LogOut size={13} />
                <span className="hidden lg:inline">Sign out</span>
              </button>
            )}
          </div>
        </header>

        {/* --- degraded banner: a direct reflection of backend state ------- */}
        {showDegradedToast && (
          <div className="flex animate-fade-in items-start gap-3 rounded-lg border border-signal-amber/30 bg-signal-amber/10 px-4 py-3">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-signal-amber" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-signal-amber">
                Live connection lost — showing simulated telemetry
              </p>
              <p className="mt-0.5 break-words text-[11px] text-signal-amber/80">
                {degradedReason}
              </p>
              <p className="mt-0.5 text-[11px] text-signal-amber/70">
                {snapshot?.will_retry === false
                  ? 'The poller has stopped retrying. Fix the credential in .env and restart the backend.'
                  : `${snapshot?.consecutive_failures ?? 0} consecutive failed poll${
                      snapshot?.consecutive_failures === 1 ? '' : 's'
                    } · retrying automatically`}
              </p>
            </div>
            <button
              onClick={() => setDismissedReason(degradedReason)}
              className="shrink-0 rounded p-0.5 text-signal-amber/70 transition-colors hover:text-signal-amber"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* --- mock-by-configuration is a default, not a failure ----------- */}
        {source === 'mock' && !degradedReason && (
          <div className="flex items-center gap-2.5 rounded-lg border border-lab-700 bg-lab-900/60 px-4 py-2.5 text-[11px] text-slate-400">
            <FlaskConical size={13} className="shrink-0 text-signal-amber" />
            <span>
              Running on <strong className="font-medium text-slate-300">simulated telemetry</strong>.
              Add your IBM API key and CRN in <strong className="font-medium text-slate-300">IBM
              credentials</strong> below to stream live fleet data — no restart needed. Setting{' '}
              <code className="font-mono text-slate-300">IBM_QUANTUM_API_KEY</code> and{' '}
              <code className="font-mono text-slate-300">IBM_QUANTUM_CRN</code> in{' '}
              <code className="font-mono text-slate-300">.env</code> still works too.
            </span>
          </div>
        )}

        {/* The playground is a different job, not a different app: the banners
            above stay put, because degraded telemetry is just as relevant when
            you are choosing a device to submit to. */}
        {view === 'playground' && <Playground backends={backends} />}

        {(view === 'bloch' || view === 'algorithms') && (
          <Suspense
            fallback={
              <div className="flex items-center gap-3 py-16 text-sm text-slate-500">
                <Atom size={18} className="animate-spin text-signal-cyan" />
                Loading the 3D lab…
              </div>
            }
          >
            <ErrorBoundary
              resetKey={view}
              fallback={(caught) => (
                <div className="panel mx-auto max-w-md px-6 py-5 text-center">
                  <AlertTriangle size={20} className="mx-auto text-signal-amber" />
                  <p className="mt-2 text-sm text-slate-200">This view hit an error</p>
                  <p className="mt-1 break-words font-mono text-[11px] text-slate-500">{caught.message}</p>
                </div>
              )}
            >
              {view === 'bloch' ? <BlochLab /> : <AlgorithmsView />}
            </ErrorBoundary>
          </Suspense>
        )}

        {/* Loading and "API unreachable" belong to the telemetry views only:
            the Bloch Lab and Algorithms run entirely in the browser, so the
            header -- and the way to reach them -- has to survive a dead backend. */}
        {view === 'dashboard' && isLoading && (
          <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-500">
            <Atom size={18} className="animate-spin text-signal-cyan" />
            Connecting to telemetry service…
          </div>
        )}

        {view === 'dashboard' && !isLoading && error && !snapshot && (
          <div className="flex justify-center py-16">
            <div className="panel max-w-md px-6 py-5 text-center">
              <WifiOff size={22} className="mx-auto text-signal-rose" />
              <h2 className="mt-3 text-sm font-medium text-slate-200">Dashboard API unreachable</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{error}</p>
              <p className="mt-3 rounded-md bg-lab-850 px-3 py-2 text-left font-mono text-[11px] text-slate-400">
                uvicorn backend.main:app --reload --port 8000
              </p>
              <p className="mt-3 text-[11px] text-slate-500">
                The Bloch Lab and Algorithms views work without it.
              </p>
            </div>
          </div>
        )}

        {view === 'dashboard' && snapshot && (
          <>
            <CredentialsCard source={source} />

            <FleetSummary summary={summary} />

            {/* ---------------------------------------------------------- */}
            <div className="grid gap-5 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <QueueChart chartData={chartData} backends={backends} />
              </div>
              <Recommender recommendations={recommendations} />
            </div>

            <div className="grid gap-5 xl:grid-cols-3">
              <section className="xl:col-span-2">
                <h2 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  QPU fleet
                  <span className="font-normal normal-case tracking-normal text-slate-600">
                    operational first, then shortest queue
                  </span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {backends.map((backend) => (
                    <QPUCard
                      key={backend.name}
                      backend={backend}
                      isRecommended={recommendedNames.has(backend.name)}
                    />
                  ))}
                </div>
              </section>
              <JobStream jobs={jobs} />
            </div>
          </>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-lab-700/50 pt-4 text-[10px] text-slate-600">
          <span>
            Snapshot {snapshot ? new Date(snapshot.generated_at).toLocaleTimeString() : '—'} · source{' '}
            <span className="font-mono">{source}</span> · one backend poller serves every connected
            client
          </span>
          <span>Estimated waits are derived, not reported by IBM.</span>
        </footer>
      </div>
    </div>
  )
}


/**
 * The authentication gate.
 *
 * Dashboard is a separate component so its telemetry hook only mounts once
 * there is a session to use it with -- otherwise the login screen would sit
 * behind a socket retrying a connection the server is right to refuse.
 */
export default function App() {
  const { isReady, isAuthenticated, authEnabled, isSubmitting, error, login, logout, refresh } =
    useAuth()

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Atom size={18} className="animate-spin text-signal-cyan" />
          Starting up…
        </div>
      </div>
    )
  }

  if (authEnabled && !isAuthenticated) {
    return <LoginScreen onSubmit={login} isSubmitting={isSubmitting} error={error} />
  }

  return <Dashboard authEnabled={authEnabled} onSignOut={logout} onAuthLost={refresh} />
}
