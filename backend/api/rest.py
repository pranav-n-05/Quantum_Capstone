"""REST surface.

Two rules hold for every endpoint in this module:

  1. It reads the cache. It never calls IBM. The poller alone does that.
  2. It answers even when the upstream is down, because the cache is always
     populated -- with live data when IBM is reachable, simulated data when not.

The initial page load uses `/api/telemetry`; after that the browser upgrades to
the WebSocket and these endpoints go quiet.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, Query, Request

from ..models import (
    BackendRecommendation,
    Circuit,
    CredentialRequest,
    CredentialStatus,
    HealthResponse,
    HistoryPoint,
    SimulationMode,
    SimulationResult,
    TelemetrySnapshot,
    TelemetrySource,
)
from ..core.analytics import recommend_backends
from ..core.execution import execute_circuit
from ..core.ibm_client import IBMAuthError, IBMQuantumError

router = APIRouter(prefix="/api", tags=["telemetry"])


def _snapshot_or_503(request: Request) -> TelemetrySnapshot:
    snapshot = request.app.state.store.get_snapshot()
    if snapshot is None:
        # Only reachable if the poller has died and the cache TTL has lapsed --
        # which is precisely when a 503 is the honest answer.
        raise HTTPException(
            status_code=503,
            detail="Telemetry cache is empty; the background poller is not running.",
        )
    return snapshot


@router.get("/telemetry", response_model=TelemetrySnapshot)
async def get_telemetry(request: Request) -> TelemetrySnapshot:
    """Current fleet snapshot -- used for the initial paint before the WebSocket opens."""
    return _snapshot_or_503(request)


@router.get("/health", response_model=HealthResponse)
async def get_health(request: Request) -> HealthResponse:
    """Liveness plus an honest report of which mode the dashboard is in."""
    state = request.app.state
    snapshot = state.store.get_snapshot()
    return HealthResponse(
        status="ok" if state.store.poller_running else "degraded",
        source=snapshot.source if snapshot else TelemetrySource.MOCK,
        live_mode_configured=state.settings.live_mode_possible,
        poller_running=state.store.poller_running,
        last_successful_poll=state.store.last_successful_poll,
        consecutive_failures=state.store.consecutive_failures,
        connected_websocket_clients=state.connections.client_count,
        history_enabled=state.history is not None,
    )


@router.get("/recommendations", response_model=list[BackendRecommendation])
async def get_recommendations(
    request: Request,
    min_qubits: int = Query(0, ge=0, le=1000, description="Only consider devices this large."),
    limit: int = Query(3, ge=1, le=10),
    include_simulators: bool = Query(False),
) -> list[BackendRecommendation]:
    """Rank the best QPUs to submit to right now, filtered to your circuit size."""
    snapshot = _snapshot_or_503(request)
    return recommend_backends(
        snapshot.backends,
        limit=limit,
        min_qubits=min_qubits,
        include_simulators=include_simulators,
    )


@router.get("/history", response_model=list[HistoryPoint])
async def get_history(
    request: Request,
    minutes: int = Query(60, ge=1, le=10_080, description="Look-back window in minutes."),
    backend: str | None = Query(None, description="Restrict to a single backend."),
) -> list[HistoryPoint]:
    """Persisted queue-depth observations, so the chart is populated on first paint."""
    history = request.app.state.history
    if history is None:
        raise HTTPException(status_code=404, detail="History is disabled (ENABLE_HISTORY=false).")
    return await history.recent(minutes=minutes, backend=backend)


@router.get("/history/busiest")
async def get_busiest(
    request: Request,
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(5, ge=1, le=20),
) -> list[dict]:
    """Average and peak queue depth per backend over a window."""
    history = request.app.state.history
    if history is None:
        raise HTTPException(status_code=404, detail="History is disabled (ENABLE_HISTORY=false).")
    return await history.busiest_backends(hours=hours, limit=limit)


# -----------------------------------------------------------------------------
# Playground
# -----------------------------------------------------------------------------
# The endpoints above read the telemetry cache. These run work the operator
# submitted. `/simulate` is the only one that never touches IBM at all -- it is
# pure local computation, which is why it needs no credentials and no guard
# beyond the circuit model's own bounds.


@router.post("/playground/simulate", response_model=SimulationResult)
async def post_simulate(
    circuit: Circuit,
    mode: SimulationMode = Query(
        SimulationMode.NOISY, description="noisy (QPU-like), ideal, or exact."
    ),
    seed: int | None = Query(None),
) -> SimulationResult:
    """Run a circuit locally and return measurement counts.

    Aer is CPU-bound and, with noise on, does real work per shot, so it goes to
    a worker thread -- otherwise a 4096-shot run would stall the poller and
    every connected WebSocket for its duration.
    """
    return await asyncio.to_thread(execute_circuit, circuit, mode=mode, seed=seed)


# -----------------------------------------------------------------------------
# Credentials (bring your own key)
# -----------------------------------------------------------------------------
# Credentials can arrive from the environment or from the browser. These
# endpoints never return the secret itself -- only a masked hint -- and never
# write it to disk. See backend/core/credentials.py for the threat model.


@router.get("/credentials", response_model=CredentialStatus)
async def get_credentials(request: Request) -> CredentialStatus:
    """What the dashboard is currently authenticated as, without the secret."""
    return request.app.state.credentials.status()


@router.post("/credentials", response_model=CredentialStatus)
async def post_credentials(request: Request, payload: CredentialRequest) -> CredentialStatus:
    """Verify credentials against IBM, then adopt them for the running poller.

    Verification happens *before* adoption so a bad key leaves the dashboard
    exactly as it was, still serving whatever it was serving.
    """
    store = request.app.state.credentials

    try:
        await store.verify(payload.api_key, payload.crn, payload.api_url)
    except IBMAuthError as exc:
        store.record_error(str(exc))
        # 401 would invite the browser to show its own auth prompt; this is a
        # rejection by a third party, not by us.
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IBMQuantumError as exc:
        store.record_error(str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    store.adopt(payload.api_key, payload.crn, payload.api_url)
    await request.app.state.poller.rebuild_client()
    return store.status()


@router.post("/credentials/clear", response_model=CredentialStatus)
async def clear_credentials(request: Request) -> CredentialStatus:
    """Forget browser-supplied credentials and revert to the environment.

    A POST rather than a DELETE so the CORS policy stays GET+POST.
    """
    store = request.app.state.credentials
    store.clear()
    await request.app.state.poller.rebuild_client()
    return store.status()
