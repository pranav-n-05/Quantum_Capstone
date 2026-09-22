"""The playground's HTTP surface, exercised through the real router.

This is the first endpoint in the project that accepts a body, so it is also
the first place where a malformed request from the browser has to produce a
useful 422 rather than a 500. The simulate route never contacts IBM, so these
tests need no credentials and no network.
"""

from __future__ import annotations

import math

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api import rest


@pytest.fixture
def client() -> TestClient:
    """A bare app with only the REST router.

    Deliberately not the real `backend.main:app`: that one runs the lifespan,
    which starts a poller and a 12-second background task. The simulate
    endpoint reads no application state, so it needs none of that.
    """
    app = FastAPI()
    app.include_router(rest.router)
    return TestClient(app)


def _bell_payload(shots: int = 512) -> dict:
    return {
        "qubits": 2,
        "shots": shots,
        "ops": [
            {"kind": "h", "qubits": [0]},
            {"kind": "cx", "qubits": [0, 1]},
        ],
    }


class TestSimulateEndpoint:
    def test_it_runs_a_bell_pair_and_returns_correlated_counts(self, client: TestClient) -> None:
        """Asserted against the exact engine -- the noisy default may err."""
        response = client.post("/api/playground/simulate?mode=exact", json=_bell_payload())

        assert response.status_code == 200
        body = response.json()
        assert set(body["counts"]) == {"00", "11"}
        assert sum(body["counts"].values()) == 512

    def test_it_defaults_to_the_noisy_engine(self, client: TestClient) -> None:
        """The default answers 'what would hardware return', not 'what is ideal'."""
        body = client.post("/api/playground/simulate", json=_bell_payload()).json()

        assert body["noisy"] is True

    def test_the_response_names_the_engine_that_ran_it(self, client: TestClient) -> None:
        body = client.post("/api/playground/simulate?mode=exact", json=_bell_payload()).json()

        assert body["engine"] == "exact"

    def test_an_unknown_mode_is_rejected(self, client: TestClient) -> None:
        response = client.post("/api/playground/simulate?mode=wishful", json=_bell_payload())

        assert response.status_code == 422

    def test_it_reports_the_shape_of_what_it_ran(self, client: TestClient) -> None:
        body = client.post("/api/playground/simulate", json=_bell_payload(256)).json()

        assert body["shots"] == 256
        assert body["qubits"] == 2

    def test_results_are_labelled_as_simulated(self, client: TestClient) -> None:
        """The UI must never be able to present a simulation as hardware output."""
        body = client.post("/api/playground/simulate", json=_bell_payload()).json()

        assert body["source"] == "mock"

    def test_an_empty_circuit_returns_the_ground_state(self, client: TestClient) -> None:
        response = client.post(
            "/api/playground/simulate?mode=exact", json={"qubits": 3, "shots": 16, "ops": []}
        )

        assert response.status_code == 200
        assert list(response.json()["counts"]) == ["000"]

    def test_a_seed_makes_the_response_reproducible(self, client: TestClient) -> None:
        first = client.post("/api/playground/simulate?seed=42&mode=exact", json=_bell_payload()).json()
        second = client.post("/api/playground/simulate?seed=42&mode=exact", json=_bell_payload()).json()

        assert first["counts"] == second["counts"]

    def test_a_rotation_angle_survives_the_round_trip(self, client: TestClient) -> None:
        response = client.post(
            "/api/playground/simulate?mode=exact",
            json={
                "qubits": 1,
                "shots": 64,
                "ops": [{"kind": "rx", "qubits": [0], "parameter": math.pi}],
            },
        )

        assert response.status_code == 200
        assert list(response.json()["counts"]) == ["1"]


class TestSimulateRejections:
    """Bad circuits must come back as 422s naming the problem, never 500s."""

    def test_a_gate_on_a_missing_qubit_is_rejected(self, client: TestClient) -> None:
        response = client.post(
            "/api/playground/simulate",
            json={"qubits": 2, "ops": [{"kind": "x", "qubits": [7]}]},
        )

        assert response.status_code == 422
        assert "outside the circuit" in response.text

    def test_an_unknown_gate_is_rejected(self, client: TestClient) -> None:
        response = client.post(
            "/api/playground/simulate",
            json={"qubits": 2, "ops": [{"kind": "toffoli", "qubits": [0]}]},
        )

        assert response.status_code == 422

    def test_a_rotation_without_an_angle_is_rejected(self, client: TestClient) -> None:
        response = client.post(
            "/api/playground/simulate",
            json={"qubits": 1, "ops": [{"kind": "rz", "qubits": [0]}]},
        )

        assert response.status_code == 422
        assert "requires a rotation angle" in response.text

    def test_too_many_shots_is_rejected(self, client: TestClient) -> None:
        response = client.post("/api/playground/simulate", json=_bell_payload(shots=100_000))

        assert response.status_code == 422

    def test_too_many_qubits_is_rejected(self, client: TestClient) -> None:
        """The ceiling exists so this stays cheap and stays submittable."""
        response = client.post("/api/playground/simulate", json={"qubits": 99, "ops": []})

        assert response.status_code == 422

    def test_a_malformed_body_is_rejected(self, client: TestClient) -> None:
        response = client.post("/api/playground/simulate", json={"nonsense": True})

        assert response.status_code == 422


class TestTelemetryRoutesStillWork:
    """The playground router shares a prefix with telemetry; check no shadowing."""

    def test_an_unpopulated_cache_still_answers_with_503_not_500(self) -> None:
        app = FastAPI()
        app.include_router(rest.router)

        class _EmptyStore:
            def get_snapshot(self) -> None:
                return None

        app.state.store = _EmptyStore()

        with TestClient(app) as client:
            assert client.get("/api/telemetry").status_code == 503
