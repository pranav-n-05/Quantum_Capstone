"""Choosing how to run a circuit.

Three execution modes, one response shape -- the same discipline the telemetry
side uses, where live and simulated snapshots are the same type and differ only
by a `source` field. Here the result always says which engine produced it and
whether noise was applied, so the UI can label it and never has to guess.

  * NOISY  -- Aer with a QPU-shaped noise model. The default, because a Bell
              pair that never shows 01 or 10 misrepresents what hardware does.
  * IDEAL  -- Aer with no noise: textbook probabilities, shot noise only.
  * EXACT  -- the dependency-free statevector simulator in `simulator.py`.

EXACT also serves as the fallback: if qiskit-aer is missing or fails, a circuit
still runs. Degrading to a correct ideal result and saying so is much better
than a 500, and it keeps the project's "works with nothing installed" promise
true even though Aer is now in requirements.txt.
"""

from __future__ import annotations

import logging
import time

from ..models import Circuit, ExecutionEngine, SimulationMode, SimulationResult, TelemetrySource
from . import aer_engine
from .simulator import simulate as simulate_exact

logger = logging.getLogger(__name__)


def execute_circuit(
    circuit: Circuit,
    *,
    mode: SimulationMode = SimulationMode.NOISY,
    seed: int | None = None,
) -> SimulationResult:
    """Run a circuit under the requested mode, falling back when Aer cannot."""
    started = time.perf_counter()

    if mode is SimulationMode.EXACT:
        return simulate_exact(circuit, seed=seed)

    noisy = mode is SimulationMode.NOISY
    try:
        counts = aer_engine.run(circuit, noisy=noisy, seed=seed)
    except aer_engine.AerUnavailable:
        logger.info("qiskit-aer unavailable; falling back to the exact simulator.")
        result = simulate_exact(circuit, seed=seed)
        result.degraded_reason = "qiskit-aer is not installed — ran the exact simulator instead."
        return result
    except Exception as exc:  # noqa: BLE001 - any Aer failure should still answer
        logger.exception("Aer execution failed; falling back to the exact simulator.")
        result = simulate_exact(circuit, seed=seed)
        result.degraded_reason = f"Aer failed ({exc}) — ran the exact simulator instead."
        return result

    return SimulationResult(
        # Sorted for a stable bar order; the frontend sorts again because
        # JavaScript reorders integer-like object keys on the way in.
        counts=dict(sorted(counts.items())),
        shots=circuit.shots,
        qubits=circuit.qubits,
        source=TelemetrySource.MOCK,
        engine=ExecutionEngine.AER,
        noisy=noisy,
        duration_ms=round((time.perf_counter() - started) * 1000, 3),
    )
