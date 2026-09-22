"""Noisy execution behaves like hardware, and the two engines agree.

The reason for having both a hand-rolled exact simulator and Aer is that each
checks the other. If our statevector maths and Qiskit's independently produce
the same distribution for the same circuit -- including the same bit ordering
-- then neither is quietly wrong, and a hardware comparison later means
something.
"""

from __future__ import annotations

import math

import pytest

from backend.core import aer_engine
from backend.core.execution import execute_circuit
from backend.models import (
    Circuit,
    ExecutionEngine,
    GateKind,
    GateOp,
    SimulationMode,
)

aer_required = pytest.mark.skipif(
    not aer_engine.is_available(), reason="qiskit-aer is not installed"
)


def _bell(shots: int = 4000) -> Circuit:
    return Circuit(
        qubits=2,
        shots=shots,
        ops=[
            GateOp(kind=GateKind.H, qubits=[0]),
            GateOp(kind=GateKind.CX, qubits=[0, 1]),
        ],
    )


class TestExactEngine:
    def test_it_is_selected_by_the_exact_mode(self) -> None:
        result = execute_circuit(_bell(), mode=SimulationMode.EXACT, seed=1)

        assert result.engine is ExecutionEngine.EXACT
        assert result.noisy is False

    def test_it_is_noiseless(self) -> None:
        result = execute_circuit(_bell(), mode=SimulationMode.EXACT, seed=1)

        assert set(result.counts) == {"00", "11"}


@aer_required
class TestIdealAer:
    def test_it_reports_the_aer_engine_without_noise(self) -> None:
        result = execute_circuit(_bell(), mode=SimulationMode.IDEAL, seed=1)

        assert result.engine is ExecutionEngine.AER
        assert result.noisy is False

    def test_an_ideal_bell_pair_has_no_error_outcomes(self) -> None:
        result = execute_circuit(_bell(), mode=SimulationMode.IDEAL, seed=1)

        assert set(result.counts) == {"00", "11"}


@aer_required
class TestNoisyAer:
    def test_it_reports_that_noise_was_applied(self) -> None:
        result = execute_circuit(_bell(), mode=SimulationMode.NOISY, seed=1)

        assert result.engine is ExecutionEngine.AER
        assert result.noisy is True

    def test_a_noisy_bell_pair_does_produce_error_outcomes(self) -> None:
        """The whole reason for the noisy mode: real devices are not ideal."""
        result = execute_circuit(_bell(), mode=SimulationMode.NOISY, seed=1)
        errors = sum(count for key, count in result.counts.items() if key not in ("00", "11"))

        assert errors > 0, "a noise model that never errs is not a noise model"

    def test_the_error_rate_is_plausible_for_real_hardware(self) -> None:
        """A few percent. Much more would be a broken device, much less a lie."""
        result = execute_circuit(_bell(), mode=SimulationMode.NOISY, seed=1)
        errors = sum(count for key, count in result.counts.items() if key not in ("00", "11"))

        assert 0.001 < errors / result.shots < 0.15

    def test_the_correct_outcomes_still_dominate(self) -> None:
        result = execute_circuit(_bell(), mode=SimulationMode.NOISY, seed=1)
        correct = result.counts.get("00", 0) + result.counts.get("11", 0)

        assert correct / result.shots > 0.85

    def test_more_two_qubit_gates_means_more_error(self) -> None:
        """Two-qubit gates dominate the error budget, as they do on hardware."""
        shallow = execute_circuit(_bell(), mode=SimulationMode.NOISY, seed=5)

        deep_ops = [GateOp(kind=GateKind.H, qubits=[0])]
        for _ in range(12):
            deep_ops.append(GateOp(kind=GateKind.CX, qubits=[0, 1]))
        deep = execute_circuit(
            Circuit(qubits=2, shots=4000, ops=deep_ops), mode=SimulationMode.NOISY, seed=5
        )

        def off_axis(result) -> int:
            return sum(c for k, c in result.counts.items() if k not in ("00", "11"))

        assert off_axis(deep) > off_axis(shallow)


@aer_required
class TestEnginesAgree:
    """The two independent implementations must describe the same physics."""

    def test_both_engines_use_the_same_bit_ordering(self) -> None:
        """X on qubit 0 of three must read '001' under either engine."""
        circuit = Circuit(qubits=3, shots=64, ops=[GateOp(kind=GateKind.X, qubits=[0])])

        exact = execute_circuit(circuit, mode=SimulationMode.EXACT, seed=1)
        aer = execute_circuit(circuit, mode=SimulationMode.IDEAL, seed=1)

        assert list(exact.counts) == ["001"]
        assert list(aer.counts) == ["001"]

    def test_both_engines_agree_on_a_two_qubit_ordering(self) -> None:
        circuit = Circuit(
            qubits=2,
            shots=64,
            ops=[GateOp(kind=GateKind.X, qubits=[0]), GateOp(kind=GateKind.CX, qubits=[0, 1])],
        )

        exact = execute_circuit(circuit, mode=SimulationMode.EXACT, seed=1)
        aer = execute_circuit(circuit, mode=SimulationMode.IDEAL, seed=1)

        assert list(exact.counts) == list(aer.counts) == ["11"]

    def test_both_engines_agree_on_a_rotation_distribution(self) -> None:
        circuit = Circuit(
            qubits=1,
            shots=4000,
            ops=[GateOp(kind=GateKind.RY, qubits=[0], parameter=math.pi / 3)],
        )

        exact = execute_circuit(circuit, mode=SimulationMode.EXACT, seed=2)
        aer = execute_circuit(circuit, mode=SimulationMode.IDEAL, seed=2)

        # RY(pi/3) puts 25% of the weight on |1>. Both should land near it.
        for result in (exact, aer):
            assert result.counts.get("1", 0) / result.shots == pytest.approx(0.25, abs=0.03)

    def test_both_engines_agree_that_hadamards_cancel(self) -> None:
        circuit = Circuit(
            qubits=1,
            shots=512,
            ops=[GateOp(kind=GateKind.H, qubits=[0]), GateOp(kind=GateKind.H, qubits=[0])],
        )

        exact = execute_circuit(circuit, mode=SimulationMode.EXACT, seed=1)
        aer = execute_circuit(circuit, mode=SimulationMode.IDEAL, seed=1)

        assert list(exact.counts) == list(aer.counts) == ["0"]


class TestResultShape:
    def test_counts_always_sum_to_the_requested_shots(self) -> None:
        for mode in SimulationMode:
            result = execute_circuit(_bell(shots=1500), mode=mode, seed=1)

            assert sum(result.counts.values()) == 1500, f"{mode} lost or invented shots"

    def test_every_bitstring_is_the_circuit_width(self) -> None:
        for mode in SimulationMode:
            result = execute_circuit(
                Circuit(qubits=3, shots=200, ops=[GateOp(kind=GateKind.H, qubits=[0])]),
                mode=mode,
                seed=1,
            )

            assert all(len(key) == 3 for key in result.counts), f"{mode} padded wrongly"

    def test_an_undegraded_run_reports_no_reason(self) -> None:
        result = execute_circuit(_bell(shots=100), mode=SimulationMode.EXACT, seed=1)

        assert result.degraded_reason is None
