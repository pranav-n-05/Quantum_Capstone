"""A circuit is validated once, in the model, for both execution paths.

Every rejection here is a mistake caught before it can reach metered quantum
hardware. The submit endpoint and the simulate endpoint share these rules
precisely so that a circuit which runs locally cannot be refused upstream --
the worst moment to discover a malformed circuit is after it has queued.
"""

from __future__ import annotations

import math

import pytest
from pydantic import ValidationError

from backend.models import (
    MAX_CIRCUIT_OPS,
    MAX_CIRCUIT_QUBITS,
    MAX_SHOTS,
    Circuit,
    GateKind,
    GateOp,
)


class TestGateKindParsing:
    def test_it_accepts_the_canonical_lowercase_name(self) -> None:
        assert GateKind.parse("cx") is GateKind.CX

    def test_it_tolerates_case_and_surrounding_space(self) -> None:
        assert GateKind.parse("  RX \n") is GateKind.RX

    def test_an_unknown_gate_is_none_rather_than_an_exception(self) -> None:
        """There is no UNKNOWN gate to degrade to -- we cannot execute a guess."""
        assert GateKind.parse("toffoli") is None
        assert GateKind.parse("") is None
        assert GateKind.parse(None) is None


class TestArity:
    def test_a_single_qubit_gate_rejects_two_operands(self) -> None:
        with pytest.raises(ValidationError, match="acts on 1 qubit"):
            Circuit(qubits=2, ops=[GateOp(kind=GateKind.H, qubits=[0, 1])])

    def test_a_two_qubit_gate_rejects_one_operand(self) -> None:
        with pytest.raises(ValidationError, match="acts on 2 qubit"):
            Circuit(qubits=2, ops=[GateOp(kind=GateKind.CX, qubits=[0])])

    def test_a_two_qubit_gate_needs_distinct_qubits(self) -> None:
        """A CX from a qubit to itself is not a circuit, it is a typo."""
        with pytest.raises(ValidationError, match="two distinct qubits"):
            Circuit(qubits=2, ops=[GateOp(kind=GateKind.CX, qubits=[1, 1])])


class TestQubitBounds:
    def test_a_gate_cannot_address_a_qubit_the_circuit_lacks(self) -> None:
        with pytest.raises(ValidationError, match="outside the circuit"):
            Circuit(qubits=2, ops=[GateOp(kind=GateKind.X, qubits=[5])])

    def test_a_negative_qubit_index_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="outside the circuit"):
            Circuit(qubits=2, ops=[GateOp(kind=GateKind.X, qubits=[-1])])

    def test_the_highest_valid_index_is_accepted(self) -> None:
        circuit = Circuit(qubits=3, ops=[GateOp(kind=GateKind.X, qubits=[2])])

        assert circuit.ops[0].qubits == [2]

    def test_the_qubit_ceiling_is_enforced(self) -> None:
        with pytest.raises(ValidationError):
            Circuit(qubits=MAX_CIRCUIT_QUBITS + 1)

    def test_a_circuit_needs_at_least_one_qubit(self) -> None:
        with pytest.raises(ValidationError):
            Circuit(qubits=0)


class TestRotationParameters:
    def test_a_rotation_without_an_angle_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="requires a rotation angle"):
            Circuit(qubits=1, ops=[GateOp(kind=GateKind.RZ, qubits=[0])])

    def test_a_non_rotation_with_an_angle_is_rejected(self) -> None:
        """Silently ignoring it would let the UI believe H took a parameter."""
        with pytest.raises(ValidationError, match="does not take a rotation angle"):
            Circuit(qubits=1, ops=[GateOp(kind=GateKind.H, qubits=[0], parameter=1.5)])

    def test_every_rotation_gate_accepts_an_angle(self) -> None:
        for kind in (GateKind.RX, GateKind.RY, GateKind.RZ):
            circuit = Circuit(qubits=1, ops=[GateOp(kind=kind, qubits=[0], parameter=math.pi)])

            assert circuit.ops[0].parameter == pytest.approx(math.pi)


class TestShots:
    def test_the_shot_ceiling_is_enforced(self) -> None:
        """This bound also limits what we are willing to spend on hardware."""
        with pytest.raises(ValidationError):
            Circuit(qubits=1, shots=MAX_SHOTS + 1)

    def test_zero_shots_is_rejected(self) -> None:
        with pytest.raises(ValidationError):
            Circuit(qubits=1, shots=0)

    def test_the_default_is_a_usable_thousand_odd_shots(self) -> None:
        assert Circuit(qubits=1).shots == 1024


class TestCircuitShape:
    def test_an_empty_circuit_is_valid(self) -> None:
        """The playground opens on one, so it must not be an error state."""
        assert Circuit(qubits=3).ops == []

    def test_depth_reports_the_gate_count(self) -> None:
        circuit = Circuit(
            qubits=2,
            ops=[
                GateOp(kind=GateKind.H, qubits=[0]),
                GateOp(kind=GateKind.CX, qubits=[0, 1]),
            ],
        )

        assert circuit.depth == 2

    def test_the_op_ceiling_is_enforced(self) -> None:
        too_many = [GateOp(kind=GateKind.X, qubits=[0])] * (MAX_CIRCUIT_OPS + 1)

        with pytest.raises(ValidationError):
            Circuit(qubits=1, ops=too_many)

    def test_the_error_names_the_offending_op_by_index(self) -> None:
        """A rejection the UI cannot localise is a rejection the user cannot fix."""
        with pytest.raises(ValidationError, match=r"op 2 \(cx\)"):
            Circuit(
                qubits=2,
                ops=[
                    GateOp(kind=GateKind.H, qubits=[0]),
                    GateOp(kind=GateKind.X, qubits=[1]),
                    GateOp(kind=GateKind.CX, qubits=[0, 9]),
                ],
            )

    def test_a_valid_circuit_round_trips_through_json(self) -> None:
        """It crosses the wire from the browser and into SQLite as JSON."""
        circuit = Circuit(
            qubits=2,
            shots=512,
            ops=[
                GateOp(kind=GateKind.H, qubits=[0]),
                GateOp(kind=GateKind.CX, qubits=[0, 1]),
                GateOp(kind=GateKind.RZ, qubits=[1], parameter=0.25),
            ],
        )

        assert Circuit.model_validate_json(circuit.model_dump_json()) == circuit
