"""Login, logout and session status.

These three routes are the only ones reachable without a session -- along with
/api/health, which has to stay open because Render's health check has no cookie
to present and a service that fails its health check is restarted forever.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from ..core.auth import COOKIE_NAME, AuthError, LockedOut
from ..models import AuthStatus, LoginRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_key(request: Request) -> str:
    """Identify the caller for throttling purposes.

    Behind a proxy every request appears to come from the proxy, so the
    forwarded address is preferred where present. This is a rate-limit key, not
    an authorisation decision -- a spoofed header costs an attacker their own
    lockout bucket and gains them nothing.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _status(request: Request, authenticated: bool) -> AuthStatus:
    sessions = request.app.state.sessions
    return AuthStatus(
        enabled=sessions.enabled,
        authenticated=authenticated or not sessions.enabled,
    )


@router.get("/status", response_model=AuthStatus)
async def auth_status(request: Request) -> AuthStatus:
    """Whether auth is on, and whether this caller is already through it."""
    sessions = request.app.state.sessions
    return _status(request, sessions.verify(request.cookies.get(COOKIE_NAME)))


@router.post("/login", response_model=AuthStatus)
async def login(request: Request, response: Response, payload: LoginRequest) -> AuthStatus:
    sessions = request.app.state.sessions

    try:
        token, max_age = sessions.login(payload.password, _client_key(request))
    except LockedOut as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=max_age,
        httponly=True,
        # Lax still sends the cookie on a normal top-level navigation, which is
        # how someone arrives at the dashboard, while blocking cross-site POSTs.
        samesite="lax",
        # Only mark Secure when the request actually arrived over TLS, or the
        # cookie would be silently dropped during local http development.
        secure=request.url.scheme == "https",
        path="/",
    )
    return _status(request, True)


@router.post("/logout", response_model=AuthStatus)
async def logout(request: Request, response: Response) -> AuthStatus:
    response.delete_cookie(COOKIE_NAME, path="/")
    sessions = request.app.state.sessions
    return AuthStatus(enabled=sessions.enabled, authenticated=not sessions.enabled)
