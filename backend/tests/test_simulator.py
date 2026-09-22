"""The simulator computes real quantum mechanics, not plausible-looking noise.

These tests check the claims a playground makes to someone learning from it:
entanglement correlates outcomes that a classical coin cannot, interference
cancels amplitudes, and the bitstrings we print mean what IBM's mean. A
simulator that merely returned a believable histogram would pass a visual
review and teach something false.
"""

from __future__ import annotations

import math

import pytest

from backend.core.simulator import probabilities, simulate, statevector
from backend.models import Circuit, GateKind, GateOp


def _circuit(qubits: int, ops: list[GateOp], shots: int = 2000) -> Circuit:
    return Circuit(qubits=qubits, ops=ops, shots=shots)


def _bell() -> Circuit:
    return _circuit(
        2,
        [
            GateOp(kind=GateKind.H, qubits=[0]),
            GateOp(kind=GateKind.CX, qubits=[0, 1]),
        ],
    )


class TestEntanglement:
    def test_a_bell_pair_only_ever_measures_00_or_11(self) -> None:
        """The whole point of entanglement: the mixed outcomes never occur.

        Two independent fair coins would produce 01 and 10 half the time. If
        they ever appear here, the CX is not entangling and every physics
        claim the playground makes is wrong.
        """
        counts = simulate(_bell(), seed=11).counts

        assert set(counts) == {"00", "11"}, f"Bell state produced {sorted(counts)}"

    def test_a_bell_pair_is_balanced_between_its_two_outcomes(self) -> None:
        counts = simulate(_bell(), seed=11).counts

        # 2000 shots: a fair split lands well inside 5 percentage points.
        assert abs(counts["00"] - counts["11"]) < 0.10 * 2000

    def test_ghz_correlates_all_three_qubits(self) -> None:
        counts = simulate(
            _circuit(
                3,
                [
                    GateOp(kind=GateKind.H, qubits=[0]),
                    GateOp(kind=GateKind.CX, qubits=[0, 1]),
                    GateOp(kind=GateKind.CX, qubits=[1, 2]),
                ],
            ),
            seed=3,
        ).counts

        assert set(counts) == {"000", "111"}


class TestBitOrdering:
    """Our bitstrings must read the way Qiskit's and IBM's do.

    Qiskit prints qubit 0 as the *rightmost* character. Getting this backwards
    is invisible on symmetric states like GHZ and silently wrong everywhere
    else -- and it would corrupt any simulator-versus-hardware comparison.
    """

    def test_qubit_zero_is_the_rightmost_character(self) -> None:
        counts = simulate(
            _circuit(3, [GateOp(kind=GateKind.X, qubits=[0])], shots=32), seed=1
        ).counts

        assert list(counts) == ["001"]

    def test_the_highest_qubit_is_the_leftmost_character(self) -> None:
        counts = simulate(
            _circuit(3, [GateOp(kind=GateKind.X, qubits=[2])], shots=32), seed=1
        ).counts

        assert list(counts) == ["100"]

    def test_every_bitstring_is_padded_to_the_qubit_count(self) -> None:
        counts = simulate(_circuit(4, [], shots=16), seed=1).counts

        assert list(counts) == ["0000"]


class TestSingleQubitGates:
    def test_x_flips_a_qubit(self) -> None:
        counts = simulate(_circuit(1, [GateOp(kind=GateKind.X, qubits=[0])], 32), seed=1).counts

        assert list(counts) == ["1"]

    def test_x_applied_twice_is_the_identity(self) -> None:
        counts = simulate(
            _circuit(
                1,
                [GateOp(kind=GateKind.X, qubits=[0]), GateOp(kind=GateKind.X, qubits=[0])],
                32,
            ),
            seed=1,
        ).counts

        assert list(counts) == ["0"]

    def test_hadamard_twice_returns_to_zero_by_interference(self) -> None:
        """H is its own inverse -- the |1> amplitudes cancel exactly.

        This is the test that a 'random 50/50' stand-in cannot pass.
        """
        counts = simulate(
            _circuit(
                1,
                [GateOp(kind=GateKind.H, qubits=[0]), GateOp(kind=GateKind.H, qubits=[0])],
                256,
            ),
            seed=5,
        ).counts

        assert list(counts) == ["0"]

    def test_a_rotation_by_pi_is_a_bit_flip(self) -> None:
        for kind in (GateKind.RX, GateKind.RY):
            counts = simulate(
                _circuit(1, [GateOp(kind=kind, qubits=[0], parameter=math.pi)], 32), seed=1
            ).counts

            assert list(counts) == ["1"], f"{kind.value}(pi) should flip the qubit"

    def test_a_half_rotation_is_an_even_superposition(self) -> None:
        probs = probabilities(
            _circuit(1, [GateOp(kind=GateKind.RY, qubits=[0], parameter=math.pi / 2)])
        )

        assert probs[0] == pytest.approx(0.5, abs=1e-9)
        assert probs[1] == pytest.approx(0.5, abs=1e-9)

    def test_z_leaves_measurement_probabilities_untouched(self) -> None:
        """Z changes phase, not populations -- invisible to a measurement."""
        probs = probabilities(
            _circuit(
                1,
                [GateOp(kind=GateKind.H, qubits=[0]), GateOp(kind=GateKind.Z, qubits=[0])],
            )
        )

        assert probs[0] == pytest.approx(0.5, abs=1e-9)


class TestTwoQubitGates:
    def test_cx_does_nothing_when_the_control_is_zero(self) -> None:
        counts = simulate(_circuit(2, [GateOp(kind=GateKind.CX, qubits=[0, 1])], 32), seed=1).counts

        assert list(counts) == ["00"]

    def test_cx_flips_the_target_when_the_control_is_one(self) -> None:
        counts = simulate(
            _circuit(
                2,
                [GateOp(kind=GateKind.X, qubits=[0]), GateOp(kind=GateKind.CX, qubits=[0, 1])],
                32,
            ),
            seed=1,
        ).counts

        # Control q0 and target q1 both set -> '11'.
        assert list(counts) == ["11"]

    def test_swap_exchanges_two_qubits(self) -> None:
        counts = simulate(
            _circuit(
                2,
                [GateOp(kind=GateKind.X, qubits=[0]), GateOp(kind=GateKind.SWAP, qubits=[0, 1])],
                32,
            ),
            seed=1,
        ).counts

        # The excitation moves from qubit 0 (rightmost) to qubit 1.
        assert list(counts) == ["10"]

    def test_cz_leaves_populations_alone(self) -> None:
        probs = probabilities(_circuit(2, [GateOp(kind=GateKind.CZ, qubits=[0, 1])]))

        assert probs[0] == pytest.approx(1.0, abs=1e-9)


class TestNumericalSanity:
    def test_probabilities_always_sum_to_one(self) -> None:
        """Normalisation is the cheapest possible check that no gate leaks."""
        messy = _circuit(
            4,
            [
                GateOp(kind=GateKind.H, qubits=[0]),
                GateOp(kind=GateKind.T, qubits=[1]),
                GateOp(kind=GateKind.CX, qubits=[0, 2]),
                GateOp(kind=GateKind.RY, qubits=[3], parameter=0.7),
                GateOp(kind=GateKind.SWAP, qubits=[1, 3]),
                GateOp(kind=GateKind.CZ, qubits=[0, 1]),
                GateOp(kind=GateKind.SDG, qubits=[2]),
                GateOp(kind=GateKind.RZ, qubits=[0], parameter=-1.1),
            ],
        )

        assert sum(probabilities(messy)) == pytest.approx(1.0, abs=1e-12)

    def test_the_statevector_has_one_amplitude_per_basis_state(self) -> None:
        assert len(statevector(_circuit(5, []))) == 32

    def test_an_empty_circuit_stays_in_the_ground_state(self) -> None:
        counts = simulate(_circuit(3, [], shots=64), seed=1).counts

        assert list(counts) == ["000"]


class TestSampling:
    def test_identical_seeds_produce_identical_counts(self) -> None:
        assert simulate(_bell(), seed=99).counts == simulate(_bell(), seed=99).counts

    def test_different_seeds_produce_different_counts(self) -> None:
        """Otherwise the seed is being ignored and determinism proves nothing."""
        assert simulate(_bell(), seed=1).counts != simulate(_bell(), seed=2).counts

    def test_the_counts_add_up_to_the_requested_shots(self) -> None:
        result = simulate(_circuit(3, [GateOp(kind=GateKind.H, qubits=[0])], shots=777), seed=4)

        assert sum(result.counts.values()) == 777
        assert result.shots == 777

    def test_the_result_reports_the_circuit_width(self) -> None:
        assert simulate(_circuit(4, [], shots=8), seed=1).qubits == 4
