"""Session authentication for a single-operator dashboard.

One shared password, set in the environment, exchanged for a signed cookie.
No user table, no registration, no password reset -- this protects one person's
instrument panel, and inventing an identity system for it would be a larger
attack surface than the thing it guards.

Design notes worth stating plainly:

  * **Tokens are signed, not encrypted.** The payload is a visible expiry and a
    fixed subject; there is nothing secret in it. The HMAC is what makes it
    unforgeable, and `hmac.compare_digest` is what keeps the comparison from
    leaking timing.
  * **stdlib only.** hmac, hashlib, secrets and base64 are enough. A JWT
    library would add a dependency and a much larger spec surface for a token
    only this process ever issues or reads.
  * **Off by default.** With no password set the dashboard behaves exactly as
    before, because its first promise is that it runs with no configuration.
    That is safe on localhost and *not* safe on a public URL, so the UI and
    /api/health both report when the door is open.
  * **Restart invalidates sessions** unless SESSION_SECRET is pinned, because
    an unset secret is generated fresh each boot. That is the safer default:
    a forgotten deployment does not keep honouring year-old cookies.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import secrets
import time

logger = logging.getLogger(__name__)

COOKIE_NAME = "qtd_session"
SUBJECT = "operator"

#: Brute-force throttle. Deliberately coarse: this guards one shared password
#: on a single-operator tool, so a short lockout after a handful of misses is
#: proportionate, and a per-account policy would be meaningless.
MAX_ATTEMPTS = 8
LOCKOUT_SECONDS = 300
ATTEMPT_WINDOW_SECONDS = 300


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


class AuthError(Exception):
    """Authentication failed. The message is safe to show the user."""


class LockedOut(AuthError):
    """Too many failed attempts from this client."""


class SessionManager:
    """Issues and validates signed session tokens."""

    def __init__(self, password: str, secret: str, session_hours: int = 12) -> None:
        self._password = password or ""
        # An unset secret gets a random one per process rather than a constant
        # default -- a shipped default signing key is a backdoor.
        self._secret = (secret or secrets.token_urlsafe(48)).encode()
        self._session_seconds = max(1, session_hours) * 3600
        self._failures: dict[str, list[float]] = {}
        self._locked_until: dict[str, float] = {}

    @property
    def enabled(self) -> bool:
        """Auth is on only when a password has actually been configured."""
        return bool(self._password.strip())

    # -- throttling ----------------------------------------------------------
    def _purge(self, client: str, now: float) -> None:
        recent = [t for t in self._failures.get(client, []) if now - t < ATTEMPT_WINDOW_SECONDS]
        if recent:
            self._failures[client] = recent
        else:
            self._failures.pop(client, None)

    def seconds_until_unlock(self, client: str) -> int:
        until = self._locked_until.get(client)
        if until is None:
            return 0
        remaining = int(until - time.time())
        if remaining <= 0:
            self._locked_until.pop(client, None)
            self._failures.pop(client, None)
            return 0
        return remaining

    def _record_failure(self, client: str) -> None:
        now = time.time()
        self._purge(client, now)
        self._failures.setdefault(client, []).append(now)
        if len(self._failures[client]) >= MAX_ATTEMPTS:
            self._locked_until[client] = now + LOCKOUT_SECONDS
            logger.warning("Locked out %s after %d failed logins.", client, MAX_ATTEMPTS)

    # -- tokens --------------------------------------------------------------
    def _sign(self, body: str) -> str:
        return _b64encode(hmac.new(self._secret, body.encode(), hashlib.sha256).digest())

    def issue(self) -> tuple[str, int]:
        """Mint a token. Returns (token, max_age_seconds)."""
        expires_at = int(time.time()) + self._session_seconds
        body = _b64encode(json.dumps({"sub": SUBJECT, "exp": expires_at}).encode())
        return f"{body}.{self._sign(body)}", self._session_seconds

    def verify(self, token: str | None) -> bool:
        """Whether a token is well-formed, correctly signed and unexpired."""
        if not self.enabled:
            return True
        if not token or "." not in token:
            return False

        body, _, signature = token.partition(".")
        # compare_digest keeps a forged signature from being distinguishable by
        # how long the rejection takes.
        if not hmac.compare_digest(signature, self._sign(body)):
            return False

        try:
            payload = json.loads(_b64decode(body))
        except (ValueError, json.JSONDecodeError):
            return False

        return payload.get("sub") == SUBJECT and float(payload.get("exp", 0)) > time.time()

    def login(self, password: str, client: str = "unknown") -> tuple[str, int]:
        """Exchange the shared password for a token, or raise."""
        if not self.enabled:
            raise AuthError("Authentication is not enabled on this server.")

        locked_for = self.seconds_until_unlock(client)
        if locked_for:
            raise LockedOut(
                f"Too many failed attempts. Try again in {locked_for} seconds."
            )

        if not hmac.compare_digest(password or "", self._password):
            self._record_failure(client)
            raise AuthError("Incorrect password.")

        self._failures.pop(client, None)
        self._locked_until.pop(client, None)
        logger.info("Operator signed in from %s.", client)
        return self.issue()
