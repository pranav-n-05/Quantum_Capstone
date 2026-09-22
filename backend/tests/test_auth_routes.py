"""The middleware gates what it should, and leaves open what it must.

Two failure modes are being defended against, and they pull in opposite
directions: a gate that lets the API through unauthenticated, and a gate so
enthusiastic it blocks the platform health check and gets the service restarted
in a loop, or blocks the static bundle that *is* the login screen.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.core.auth import COOKIE_NAME


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """The real app, with a password configured.

    get_settings is lru_cached, so the environment has to be set and the cache
    cleared before the app's lifespan reads it.
    """
    monkeypatch.setenv("ADMIN_PASSWORD", "correct-horse")
    monkeypatch.setenv("SESSION_SECRET", "fixed-test-secret")
    monkeypatch.setenv("ENABLE_HISTORY", "false")

    from backend.config import get_settings

    get_settings.cache_clear()
    from backend.main import app

    with TestClient(app) as running:
        yield running
    get_settings.cache_clear()


class TestGatedRoutes:
    @pytest.mark.parametrize(
        "path", ["/api/telemetry", "/api/credentials", "/api/recommendations"]
    )
    def test_the_api_is_401_without_a_session(self, client: TestClient, path: str) -> None:
        assert client.get(path).status_code == 401

    def test_the_playground_is_gated_too(self, client: TestClient) -> None:
        """Otherwise anyone could spend this server's CPU on 4096-shot runs."""
        response = client.post(
            "/api/playground/simulate", json={"qubits": 1, "ops": []}
        )

        assert response.status_code == 401

    def test_a_forged_cookie_does_not_open_the_door(self, client: TestClient) -> None:
        client.cookies.set(COOKIE_NAME, "forged.token")

        assert client.get("/api/telemetry").status_code == 401


class TestPublicRoutes:
    def test_health_stays_open(self, client: TestClient) -> None:
        """Render's health check has no cookie; gating this restarts us forever."""
        assert client.get("/api/health").status_code == 200

    def test_auth_status_stays_open(self, client: TestClient) -> None:
        body = client.get("/api/auth/status").json()

        assert body == {"enabled": True, "authenticated": False}


class TestLoginFlow:
    def test_the_wrong_password_is_401_and_sets_no_cookie(self, client: TestClient) -> None:
        response = client.post("/api/auth/login", json={"password": "wrong"})

        assert response.status_code == 401
        assert COOKIE_NAME not in response.cookies

    def test_the_right_password_sets_an_httponly_cookie(self, client: TestClient) -> None:
        response = client.post("/api/auth/login", json={"password": "correct-horse"})

        assert response.status_code == 200
        assert "httponly" in response.headers["set-cookie"].lower()

    def test_a_session_unlocks_the_api(self, client: TestClient) -> None:
        client.post("/api/auth/login", json={"password": "correct-horse"})

        assert client.get("/api/telemetry").status_code == 200

    def test_an_empty_password_is_rejected_by_validation(self, client: TestClient) -> None:
        assert client.post("/api/auth/login", json={"password": ""}).status_code == 422

    def test_logout_closes_the_door_again(self, client: TestClient) -> None:
        client.post("/api/auth/login", json={"password": "correct-horse"})
        assert client.get("/api/telemetry").status_code == 200

        client.post("/api/auth/logout")

        assert client.get("/api/telemetry").status_code == 401


class TestAuthDisabled:
    def test_everything_is_open_when_no_password_is_set(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """The zero-configuration default must survive the addition of auth."""
        monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
        monkeypatch.setenv("ENABLE_HISTORY", "false")

        from backend.config import get_settings

        get_settings.cache_clear()
        from backend.main import app

        with TestClient(app) as client:
            assert client.get("/api/telemetry").status_code == 200
            assert client.get("/api/auth/status").json() == {
                "enabled": False,
                "authenticated": True,
            }
        get_settings.cache_clear()
