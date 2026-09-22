"""The lock actually locks.

A dashboard that accepts an API key from the browser is only as safe as the
door in front of it, so these tests defend the door rather than the plumbing:
a forged cookie must not open it, an expired one must not either, the health
check must stay open or the platform restarts us forever, and turning the
password off must restore the zero-configuration behaviour exactly.
"""

from __future__ import annotations

import time

import pytest

from backend.core.auth import COOKIE_NAME, AuthError, LockedOut, SessionManager


@pytest.fixture
def sessions() -> SessionManager:
    return SessionManager(password="correct-horse", secret="fixed-secret", session_hours=12)


class TestTokenIntegrity:
    def test_a_freshly_issued_token_verifies(self, sessions: SessionManager) -> None:
        token, _ = sessions.issue()

        assert sessions.verify(token)

    def test_a_tampered_signature_is_rejected(self, sessions: SessionManager) -> None:
        token, _ = sessions.issue()
        body, _, signature = token.partition(".")

        assert not sessions.verify(f"{body}.{signature[:-3]}xxx")

    def test_a_tampered_payload_is_rejected(self, sessions: SessionManager) -> None:
        """Re-signing requires the secret, which the client never sees."""
        token, _ = sessions.issue()
        _, _, signature = token.partition(".")

        forged_body = "eyJzdWIiOiAib3BlcmF0b3IiLCAiZXhwIjogOTk5OTk5OTk5OX0"
        assert not sessions.verify(f"{forged_body}.{signature}")

    def test_garbage_is_rejected(self, sessions: SessionManager) -> None:
        for candidate in ("", "nonsense", "a.b", None, "....", "a." * 50):
            assert not sessions.verify(candidate), f"{candidate!r} should not verify"

    def test_a_token_from_a_different_secret_is_rejected(self) -> None:
        """A restart without a pinned SESSION_SECRET must invalidate sessions."""
        first = SessionManager("pw", "secret-one")
        second = SessionManager("pw", "secret-two")
        token, _ = first.issue()

        assert not second.verify(token)

    def test_an_expired_token_is_rejected(self) -> None:
        sessions = SessionManager("pw", "s", session_hours=1)
        token, _ = sessions.issue()
        # Reach past the expiry rather than sleeping an hour.
        sessions._session_seconds = -10  # noqa: SLF001
        stale, _ = sessions.issue()

        assert sessions.verify(token)
        assert not sessions.verify(stale)


class TestLogin:
    def test_the_right_password_issues_a_token(self, sessions: SessionManager) -> None:
        token, max_age = sessions.login("correct-horse", "client-a")

        assert sessions.verify(token)
        assert max_age == 12 * 3600

    def test_the_wrong_password_is_refused(self, sessions: SessionManager) -> None:
        with pytest.raises(AuthError):
            sessions.login("wrong", "client-a")

    def test_an_empty_password_is_refused(self, sessions: SessionManager) -> None:
        with pytest.raises(AuthError):
            sessions.login("", "client-a")

    def test_repeated_failures_lock_the_client_out(self, sessions: SessionManager) -> None:
        for _ in range(8):
            with pytest.raises(AuthError):
                sessions.login("wrong", "attacker")

        with pytest.raises(LockedOut):
            sessions.login("wrong", "attacker")

    def test_a_lockout_blocks_even_the_correct_password(self, sessions: SessionManager) -> None:
        """Otherwise the throttle would not slow a search down at all."""
        for _ in range(8):
            with pytest.raises(AuthError):
                sessions.login("wrong", "attacker")

        with pytest.raises(LockedOut):
            sessions.login("correct-horse", "attacker")

    def test_one_clients_lockout_does_not_affect_another(self, sessions: SessionManager) -> None:
        for _ in range(9):
            with pytest.raises(AuthError):
                sessions.login("wrong", "attacker")

        assert sessions.login("correct-horse", "someone-else")[0]

    def test_a_successful_login_clears_earlier_failures(self, sessions: SessionManager) -> None:
        for _ in range(3):
            with pytest.raises(AuthError):
                sessions.login("wrong", "clumsy")
        sessions.login("correct-horse", "clumsy")

        for _ in range(7):
            with pytest.raises(AuthError):
                sessions.login("wrong", "clumsy")


class TestDisabledByDefault:
    """No password means no lock -- the zero-configuration promise."""

    def test_auth_is_off_when_no_password_is_configured(self) -> None:
        assert SessionManager("", "").enabled is False

    def test_whitespace_is_not_a_password(self) -> None:
        assert SessionManager("   ", "").enabled is False

    def test_everything_verifies_when_auth_is_off(self) -> None:
        sessions = SessionManager("", "")

        assert sessions.verify(None)
        assert sessions.verify("obvious nonsense")

    def test_logging_in_when_disabled_is_an_error(self) -> None:
        with pytest.raises(AuthError):
            SessionManager("", "").login("anything")


class TestCookieName:
    def test_the_cookie_name_is_stable(self) -> None:
        """The frontend and the WebSocket handler both depend on this string."""
        assert COOKIE_NAME == "qtd_session"
