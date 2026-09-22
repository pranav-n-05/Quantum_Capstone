"""Qiskit Aer execution, with a noise model shaped like a real QPU.

The exact simulator in `simulator.py` answers "what does the maths say". This
answers "what would the hardware actually return", which is a different and
often more interesting question: a Bell pair on a real device does produce 01
and 10 a few percent of the time, and a playground that never shows that is
teaching an idealisation.

Aer is imported lazily. It pulls numpy, scipy and rustworkx behind it, and the
dashboard's promise is that it starts instantly with no configuration -- so
nothing here is touched until someone actually runs a circuit.

The noise model is a deliberate approximation, not a calibration snapshot:

  * Single-qubit ``sx``/``x`` depolarising at 2.5e-4, the order of magnitude
    IBM reports for Heron-class devices.
  * Two-qubit ``cx`` depolarising at 7e-3. This dominates everything else,
    which is why circuit quality is mostly a question of two-qubit gate count.
  * Readout error a little under 2%, asymmetric because |1> decays toward |0>
    during measurement but not the other way.
  * ``rz`` is left noiseless on purpose: on real superconducting hardware it is
    a frame change performed in software, not a pulse, so it is genuinely free.

Real per-qubit calibration data would need a live device; this is the honest
generic stand-in, and it is labelled as such everywhere it surfaces.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

from ..models import Circuit, GateKind

logger = logging.getLogger(__name__)

#: The gate set we transpile to before attaching noise. Chosen to look like an
#: IBM device's basis so the error channels land where they land in reality.
BASIS_GATES = ["id", "rz", "sx", "x", "cx"]

SINGLE_QUBIT_ERROR = 2.5e-4
TWO_QUBIT_ERROR = 7e-3
READOUT_P0_GIVEN_1 = 0.022
READOUT_P1_GIVEN_0 = 0.013


class AerUnavailable(RuntimeError):
    """qiskit-aer is not installed in this environment."""


def is_available() -> bool:
    """Whether Aer can be used, without paying the import cost twice."""
    try:
        _imports()
    except AerUnavailable:
        return False
    return True


@lru_cache(maxsize=1)
def _imports() -> dict[str, Any]:
    """Import qiskit lazily and cache the handles.

    lru_cache makes this import-once: the first circuit pays ~1s, every
    subsequent one pays nothing.
    """
    try:
        from qiskit import QuantumCircuit, transpile
        from qiskit_aer import AerSimulator
        from qiskit_aer.noise import NoiseModel, ReadoutError, depolarizing_error
    except ImportError as exc:  # pragma: no cover - depends on the environment
        raise AerUnavailable(
            "qiskit-aer is not installed. Install it with "
            "`pip install -r backend/requirements.txt`."
        ) from exc

    return {
        "QuantumCircuit": QuantumCircuit,
        "transpile": transpile,
        "AerSimulator": AerSimulator,
        "NoiseModel": NoiseModel,
        "ReadoutError": ReadoutError,
        "depolarizing_error": depolarizing_error,
    }


@lru_cache(maxsize=1)
def _noise_model() -> Any:
    """A generic superconducting-QPU noise model. Built once, reused forever."""
    api = _imports()
    model = api["NoiseModel"]()

    model.add_all_qubit_quantum_error(
        api["depolarizing_error"](SINGLE_QUBIT_ERROR, 1), ["sx", "x", "id"]
    )
    model.add_all_qubit_quantum_error(api["depolarizing_error"](TWO_QUBIT_ERROR, 2), ["cx"])
    model.add_all_qubit_readout_error(
        api["ReadoutError"](
            [
                [1 - READOUT_P1_GIVEN_0, READOUT_P1_GIVEN_0],
                [READOUT_P0_GIVEN_1, 1 - READOUT_P0_GIVEN_1],
            ]
        )
    )
    return model


def _to_qiskit(circuit: Circuit) -> Any:
    """Translate our circuit model into a Qiskit QuantumCircuit.

    Both use qubit 0 as the least significant bit and print bitstrings with
    qubit 0 rightmost, so no index reversal is needed -- a correspondence the
    tests pin down rather than assume.
    """
    api = _imports()
    qc = api["QuantumCircuit"](circuit.qubits)

    for op in circuit.ops:
        target = op.qubits
        match op.kind:
            case GateKind.H:
                qc.h(target[0])
            case GateKind.X:
                qc.x(target[0])
            case GateKind.Y:
                qc.y(target[0])
            case GateKind.Z:
                qc.z(target[0])
            case GateKind.S:
                qc.s(target[0])
            case GateKind.SDG:
                qc.sdg(target[0])
            case GateKind.T:
                qc.t(target[0])
            case GateKind.TDG:
                qc.tdg(target[0])
            case GateKind.RX:
                qc.rx(op.parameter, target[0])
            case GateKind.RY:
                qc.ry(op.parameter, target[0])
            case GateKind.RZ:
                qc.rz(op.parameter, target[0])
            case GateKind.CX:
                qc.cx(target[0], target[1])
            case GateKind.CZ:
                qc.cz(target[0], target[1])
            case GateKind.SWAP:
                qc.swap(target[0], target[1])

    qc.measure_all()
    return qc


def run(circuit: Circuit, *, noisy: bool = True, seed: int | None = None) -> dict[str, int]:
    """Execute a circuit on Aer and return measurement counts.

    Raises AerUnavailable when qiskit-aer is not installed, so the caller can
    fall back to the exact simulator rather than failing the request.
    """
    api = _imports()

    backend = (
        api["AerSimulator"](noise_model=_noise_model(), basis_gates=BASIS_GATES)
        if noisy
        else api["AerSimulator"]()
    )

    # The backend already carries the basis gates when noisy, so passing them
    # here too would make qiskit warn about discarding its error rates.
    compiled = api["transpile"](
        _to_qiskit(circuit),
        backend,
        optimization_level=0,
        seed_transpiler=seed,
    )

    result = backend.run(compiled, shots=circuit.shots, seed_simulator=seed).result()
    counts = result.get_counts()

    # measure_all() names its register, and Aer can return space-separated
    # fields for multiple registers. Keep only the measurement bits.
    return {key.replace(" ", ""): int(value) for key, value in counts.items()}
