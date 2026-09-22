"""An exact statevector simulator for playground circuits.

Hand-rolled and dependency-free, for the same reason the IBM client is: the
whole app runs with no configuration, and that promise should extend to running
a circuit. Pulling qiskit in just to simulate eight qubits would put a ~40MB
import on the path of the one feature that is supposed to work instantly.

The scale makes this easy. Eight qubits is 256 complex amplitudes; Python's
built-in ``complex`` handles that in well under a millisecond. A simulator that
needed to be fast would need numpy. This one needs to be *correct*.

Conventions, both of which matter more than they look:

  * **Qubit 0 is the least significant bit.** Basis state index ``i`` has qubit
    ``q`` set when ``(i >> q) & 1``.
  * **Bitstrings read qubit n-1 first**, so qubit 0 is the rightmost character.
    This is Qiskit's convention and therefore IBM's. Diverging from it would
    make simulated and hardware results for the same circuit disagree while
    both looked plausible -- see ``tests/test_simulator.py``.
"""

from __future__ import annotations

import cmath
import math
import random
import time
from collections import Counter

from ..models import Circuit, GateKind, GateOp, SimulationResult, TelemetrySource

#: 1/sqrt(2), the Hadamard amplitude.
_INV_SQRT2 = 1.0 / math.sqrt(2.0)

#: Fixed single-qubit gates as (m00, m01, m10, m11) row-major tuples.
_STATIC_MATRICES: dict[GateKind, tuple[complex, complex, complex, complex]] = {
    GateKind.H: (_INV_SQRT2, _INV_SQRT2, _INV_SQRT2, -_INV_SQRT2),
    GateKind.X: (0, 1, 1, 0),
    GateKind.Y: (0, -1j, 1j, 0),
    GateKind.Z: (1, 0, 0, -1),
    GateKind.S: (1, 0, 0, 1j),
    GateKind.SDG: (1, 0, 0, -1j),
    GateKind.T: (1, 0, 0, cmath.exp(1j * math.pi / 4)),
    GateKind.TDG: (1, 0, 0, cmath.exp(-1j * math.pi / 4)),
}


def _rotation_matrix(kind: GateKind, theta: float) -> tuple[complex, complex, complex, complex]:
    """Standard RX/RY/RZ matrices, matching Qiskit's global-phase choice."""
    half = theta / 2.0
    cos, sin = math.cos(half), math.sin(half)
    if kind is GateKind.RX:
        return (cos, -1j * sin, -1j * sin, cos)
    if kind is GateKind.RY:
        return (cos, -sin, sin, cos)
    if kind is GateKind.RZ:
        return (cmath.exp(-1j * half), 0, 0, cmath.exp(1j * half))
    raise ValueError(f"{kind} is not a rotation.")


def _apply_single(state: list[complex], qubit: int, matrix: tuple[complex, ...]) -> None:
    """Apply a 2x2 matrix to one qubit, in place.

    Amplitudes pair up by the target bit: for every index with that bit clear
    there is exactly one partner with it set, and the matrix mixes the pair.
    Iterating only over the bit-clear half visits each pair once.
    """
    m00, m01, m10, m11 = matrix
    bit = 1 << qubit
    for low in range(len(state)):
        if low & bit:
            continue
        high = low | bit
        a, b = state[low], state[high]
        state[low] = m00 * a + m01 * b
        state[high] = m10 * a + m11 * b


def _apply_cx(state: list[complex], control: int, target: int) -> None:
    """Flip the target amplitude pair wherever the control bit is set."""
    control_bit, target_bit = 1 << control, 1 << target
    for index in range(len(state)):
        if index & control_bit and not index & target_bit:
            partner = index | target_bit
            state[index], state[partner] = state[partner], state[index]


def _apply_cz(state: list[complex], a: int, b: int) -> None:
    """Negate the amplitude of every basis state with both bits set."""
    both = (1 << a) | (1 << b)
    for index in range(len(state)):
        if index & both == both:
            state[index] = -state[index]


def _apply_swap(state: list[complex], a: int, b: int) -> None:
    """Exchange amplitudes between basis states differing only in these bits."""
    a_bit, b_bit = 1 << a, 1 << b
    for index in range(len(state)):
        if index & a_bit and not index & b_bit:
            partner = (index & ~a_bit) | b_bit
            state[index], state[partner] = state[partner], state[index]


def _apply(state: list[complex], op: GateOp) -> None:
    if op.kind in _STATIC_MATRICES:
        _apply_single(state, op.qubits[0], _STATIC_MATRICES[op.kind])
    elif op.parameter is not None:
        _apply_single(state, op.qubits[0], _rotation_matrix(op.kind, op.parameter))
    elif op.kind is GateKind.CX:
        _apply_cx(state, op.qubits[0], op.qubits[1])
    elif op.kind is GateKind.CZ:
        _apply_cz(state, op.qubits[0], op.qubits[1])
    elif op.kind is GateKind.SWAP:
        _apply_swap(state, op.qubits[0], op.qubits[1])
    else:  # pragma: no cover -- Circuit validation makes this unreachable.
        raise ValueError(f"Unsupported gate {op.kind}.")


def statevector(circuit: Circuit) -> list[complex]:
    """Evolve |0...0> through the circuit and return the final amplitudes."""
    state: list[complex] = [0j] * (2**circuit.qubits)
    state[0] = 1 + 0j
    for op in circuit.ops:
        _apply(state, op)
    return state


def probabilities(circuit: Circuit) -> list[float]:
    """Exact measurement probabilities, one per basis state."""
    return [abs(amplitude) ** 2 for amplitude in statevector(circuit)]


def simulate(circuit: Circuit, seed: int | None = None) -> SimulationResult:
    """Run a circuit and sample `circuit.shots` measurements of every qubit.

    Sampling rather than returning exact probabilities is deliberate: hardware
    returns counts, and a playground whose simulated output has a different
    *shape* from its hardware output teaches the wrong thing. Shot noise is
    part of the lesson.
    """
    started = time.perf_counter()
    weights = probabilities(circuit)

    # All randomness flows through one seeded Random, mirroring mock_service,
    # so a seeded run is reproducible in tests.
    rng = random.Random(seed)
    width = circuit.qubits
    sampled = rng.choices(range(len(weights)), weights=weights, k=circuit.shots)
    counts = Counter(format(index, f"0{width}b") for index in sampled)

    return SimulationResult(
        # Sorted so the histogram's bar order is stable between runs.
        counts=dict(sorted(counts.items())),
        shots=circuit.shots,
        qubits=width,
        source=TelemetrySource.MOCK,
        duration_ms=round((time.perf_counter() - started) * 1000, 3),
    )
