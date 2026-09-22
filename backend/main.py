"""Application entry point.

Wires the four moving parts together and owns their lifecycle:

    settings  ->  store (cache)  ->  poller  ->  API routers

The poller is started on application startup and cancelled on shutdown, so the
process never leaks a background task, and `uvicorn --reload` does not end up
with two pollers racing each other against IBM's rate limit.

Run it with:

    uvicorn backend.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pathlib import Path

from fastapi.responses import JSONResponse

from .api import auth as auth_routes, rest, websocket
from .api.websocket import ConnectionManager
from .config import get_settings
from .core.cache import TelemetryStore
from .core.history import HistoryStore
from .core.auth import COOKIE_NAME, SessionManager
from .core.credentials import CredentialStore
from .core.poller import TelemetryPoller
from .static import mount_frontend

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("quantum-dashboard")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    # TTL is a multiple of the poll interval: one missed tick must not blank the
    # dashboard, but a genuinely dead poller must become visible rather than
    # letting us serve an hour-old snapshot as if it were current.
    store = TelemetryStore(ttl_seconds=settings.poll_interval_seconds * 6)
    connections = ConnectionManager()

    history: HistoryStore | None = None
    if settings.enable_history:
        history = HistoryStore(
            db_path=settings.resolved_history_path,
            retention_days=settings.history_retention_days,
        )
        await history.initialise()

    poller = TelemetryPoller(
        settings=settings,
        store=store,
        history=history,
        broadcast=connections.broadcast,
    )

    app.state.settings = settings
    app.state.store = store
    app.state.connections = connections
    app.state.history = history
    app.state.poller = poller
    app.state.credentials = CredentialStore(settings)
    app.state.sessions = SessionManager(
        password=settings.admin_password,
        secret=settings.session_secret,
        session_hours=settings.session_hours,
    )

    if settings.auth_enabled:
        logger.info("Authentication is ON -- a password is required.")
    else:
        logger.warning(
            "Authentication is OFF: anyone who can reach this server can use it "
            "and can set IBM credentials on it. Set ADMIN_PASSWORD before "
            "exposing it beyond localhost."
        )

    if settings.live_mode_possible:
        logger.info("Credentials detected -- attempting LIVE IBM Quantum telemetry.")
    elif settings.force_mock_mode:
        logger.info("FORCE_MOCK_MODE is on -- serving simulated telemetry.")
    else:
        logger.info(
            "No IBM credentials found -- serving simulated telemetry. "
            "Add IBM_QUANTUM_API_KEY and IBM_QUANTUM_CRN to .env for live mode."
        )

    await poller.start()
    try:
        yield
    finally:
        await poller.stop()


app = FastAPI(
    title="IBM Quantum Live Telemetry Dashboard",
    description=(
        "Real-time queue, status and job telemetry for the IBM Quantum QPU fleet. "
        "One background poller serves every connected client, so IBM sees a "
        "constant request rate regardless of how many browsers are open."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_credentials=True,
    # GET for telemetry, POST for the playground. Still an explicit list rather
    # than ["*"]: nothing here should ever be reachable by PUT or DELETE.
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

#: Reachable without a session. /api/health stays open because a platform
#: health check arrives with no cookie, and a service that fails its health
#: check gets restarted in a loop.
_PUBLIC_API_PATHS = frozenset(
    {"/api/health", "/api/auth/login", "/api/auth/logout", "/api/auth/status"}
)


@app.middleware("http")
async def require_session(request, call_next):
    """Gate the API behind a session cookie when a password is configured.

    Only /api and /ws are gated. The static bundle is served to anyone, because
    the login screen *is* the React app -- protecting it would leave nothing to
    log in with. Nothing sensitive lives in the bundle; the data it renders is
    all behind these checks.
    """
    sessions = getattr(request.app.state, "sessions", None)
    path = request.url.path

    needs_session = (
        sessions is not None
        and sessions.enabled
        and (path.startswith("/api") or path.startswith("/ws"))
        and path not in _PUBLIC_API_PATHS
    )

    if needs_session and not sessions.verify(request.cookies.get(COOKIE_NAME)):
        return JSONResponse(
            status_code=401,
            content={"detail": "Sign in to use this dashboard."},
        )

    return await call_next(request)


app.include_router(auth_routes.router)
app.include_router(rest.router)
app.include_router(websocket.router)


@app.get("/api", tags=["meta"])
async def api_root() -> dict[str, str]:
    return {
        "name": "IBM Quantum Live Telemetry Dashboard",
        "docs": "/docs",
        "telemetry": "/api/telemetry",
        "health": "/api/health",
        "stream": "/ws/telemetry",
    }


# Mounted last, deliberately: routes are matched in registration order, so a
# catch-all at "/" registered earlier would shadow /api and /ws.
_FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
_frontend_mounted = mount_frontend(app, _FRONTEND_DIST)

if not _frontend_mounted:

    @app.get("/", tags=["meta"])
    async def root() -> dict[str, str]:
        return {
            "name": "IBM Quantum Live Telemetry Dashboard",
            "note": "Frontend not built; run `npm run build` in frontend/.",
            "docs": "/docs",
            "telemetry": "/api/telemetry",
        }
