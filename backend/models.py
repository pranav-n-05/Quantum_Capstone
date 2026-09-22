"""Typed domain model for the dashboard.

This module is the contract between IBM's REST payloads, the simulator, the
WebSocket stream and the React frontend. Both the live client and the mock
service emit these exact types, which is why the frontend cannot tell them
apart -- and why swapping one for the other during an outage is safe.

Field names here follow IBM's REST vocabulary where IBM has one, and our own
where IBM does not (see `estimated_wait_seconds`).
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


# -----------------------------------------------------------------------------
# Enumerations
# -----------------------------------------------------------------------------
class BackendStatus(str, Enum):
    """Operational state of a QPU.

    IBM returns these inside a nested object as ``{"name": "online", ...}``
    with the values below. We flatten that object but keep IBM's vocabulary.
    """

    ONLINE = "online"
    PAUSED = "paused"
    OFFLINE = "offline"
    UNKNOWN = "unknown"

    @classmethod
    def parse(cls, raw: str | None) -> "BackendStatus":
        if not raw:
            return cls.UNKNOWN
        try:
            return cls(raw.strip().lower())
        except ValueError:
            return cls.UNKNOWN

    @property
    def is_accepting_jobs(self) -> bool:
        return self is BackendStatus.ONLINE


class JobStatus(str, Enum):
    """Lifecycle state of a Runtime job.

    IBM returns title-case values (``Queued``, ``Running``, ``Completed``,
    ``Cancelled``, ``Failed``). We normalise to upper snake so the frontend
    has a single stable vocabulary to colour-code against.
    """

    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def parse(cls, raw: str | None) -> "JobStatus":
        if not raw:
            return cls.UNKNOWN
        normalised = raw.strip().upper()
        # IBM has used a few synonyms across API versions; fold them in.
        aliases = {
            "DONE": cls.COMPLETED,
            "COMPLETE": cls.COMPLETED,
            "ERROR": cls.FAILED,
            "CANCELED": cls.CANCELLED,
            "PENDING": cls.QUEUED,
            "INITIALIZING": cls.RUNNING,
            "VALIDATING": cls.QUEUED,
        }
        if normalised in aliases:
            return aliases[normalised]
        try:
            return cls(normalised)
        except ValueError:
            return cls.UNKNOWN

    @property
    def is_terminal(self) -> bool:
        return self in (JobStatus.COMPLETED, JobStatus.CANCELLED, JobStatus.FAILED)


class TelemetrySource(str, Enum):
    """Where the payload the frontend is looking at actually came from.

    This is the field the whole graceful-degradation story hangs on: the UI's
    mode toggle reflects *this*, never a frontend-local flag.
    """

    LIVE = "live"
    MOCK = "mock"


# -----------------------------------------------------------------------------
# Core entities
# -----------------------------------------------------------------------------
class QPUBackend(BaseModel):
    """A single quantum processing unit."""

    name: str = Field(description="IBM backend identifier, e.g. 'ibm_torino'.")
    status: BackendStatus = BackendStatus.UNKNOWN
    status_reason: str | None = Field(
        default=None, description="IBM's explanation when a QPU is paused or offline."
    )
    queue_length: int = Field(default=0, ge=0, description="Jobs waiting to execute.")
    qubits: int = Field(default=0, ge=0, description="Programmable qubit count.")
    clops: int | None = Field(
        default=None, description="Circuit Layer Operations Per Second; higher is faster."
    )
    is_simulator: bool = False
    processor_type: str | None = Field(
        default=None, description="Processor family, e.g. 'Heron r2'."
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def estimated_wait_seconds(self) -> int:
        """Rough time-to-start, derived rather than reported.

        IBM's documented /v1/backends response does **not** include a wait-time
        field, so we estimate it instead of inventing one: queue depth times a
        nominal per-job service time, scaled down for faster processors. This is
        surfaced to the UI clearly labelled as an estimate.
        """
        if not self.status.is_accepting_jobs:
            return 0
        # Nominal seconds a single Runtime job occupies a QPU, empirically ~45s.
        nominal_service_seconds = 45.0
        if self.clops:
            # Normalise against a 180k CLOPS reference machine; clamp so an
            # unusually fast or slow device cannot produce absurd estimates.
            speed_factor = max(0.4, min(2.5, 180_000 / max(self.clops, 1)))
        else:
            speed_factor = 1.0
        return int(self.queue_length * nominal_service_seconds * speed_factor)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_operational(self) -> bool:
        return self.status.is_accepting_jobs


class QuantumJob(BaseModel):
    """A Runtime job observed on the account."""

    id: str
    backend: str
    status: JobStatus = JobStatus.UNKNOWN
    program_id: str | None = None
    created: datetime
    session_id: str | None = None
    qpu_charge_time_seconds: float | None = None
    tags: list[str] = Field(default_factory=list)


class BackendRecommendation(BaseModel):
    """One entry in the 'where should I submit right now?' ranking."""

    backend_name: str
    score: float = Field(ge=0.0, le=100.0)
    rank: int = Field(ge=1)
    rationale: str
    queue_length: int
    qubits: int
    estimated_wait_seconds: int


class FleetSummary(BaseModel):
    """Headline numbers across the whole fleet."""

    total_backends: int = 0
    online_backends: int = 0
    paused_backends: int = 0
    offline_backends: int = 0
    total_qubits_available: int = 0
    total_queued_jobs: int = 0
    jobs_in_flight: int = 0
    median_queue_depth: float = 0.0
    busiest_backend: str | None = None
    quietest_operational_backend: str | None = None


class TelemetrySnapshot(BaseModel):
    """The single payload shape pushed over the WebSocket and returned by REST.

    Live and mock telemetry are the *same* type; only `source` differs.
    """

    source: TelemetrySource
    generated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When this snapshot was produced by the backend.",
    )
    backends: list[QPUBackend] = Field(default_factory=list)
    jobs: list[QuantumJob] = Field(default_factory=list)
    summary: FleetSummary = Field(default_factory=FleetSummary)
    recommendations: list[BackendRecommendation] = Field(default_factory=list)

    # Diagnostics -- shown in the UI footer so the operator knows why the
    # dashboard is in whichever mode it is in.
    degraded_reason: str | None = Field(
        default=None,
        description="Populated when source == 'mock' despite live mode being configured.",
    )
    poll_interval_seconds: float = 12.0
    consecutive_failures: int = 0
    will_retry: bool = Field(
        default=True,
        description=(
            "False when the poller has stopped attempting live calls (a rejected "
            "credential). The UI must not promise an automatic recovery that is "
            "not coming."
        ),
    )


class HistoryPoint(BaseModel):
    """One persisted queue-depth observation for a single backend."""

    backend: str
    queue_length: int
    recorded_at: datetime


class HealthResponse(BaseModel):
    status: str
    source: TelemetrySource
    live_mode_configured: bool
    poller_running: bool
    last_successful_poll: datetime | None = None
    consecutive_failures: int = 0
    connected_websocket_clients: int = 0
    history_enabled: bool = False


# -----------------------------------------------------------------------------
# Playground: circuits, simulation and submission
# -----------------------------------------------------------------------------
# The rest of this module describes telemetry we *observe*. Everything below
# describes work the operator *creates* -- a circuit built in the browser, run
# on the local simulator or submitted to a real QPU.
#
# Measurement is implicit: every qubit is measured at the end of the circuit.
# Mid-circuit measurement would require modelling classical registers and
# state collapse, which buys a teaching playground nothing and costs it a lot.

#: Hard ceilings. These are the *product* limits, deliberately far below what
#: the simulator could manage, because every one of them also bounds what we
#: are willing to send to metered quantum hardware.
MAX_CIRCUIT_QUBITS = 8
MAX_CIRCUIT_OPS = 256
MAX_SHOTS = 4096


class GateKind(str, Enum):
    """The gate vocabulary the playground offers.

    Deliberately small: a universal set (Clifford+T plus arbitrary rotations)
    with the two-qubit gates needed to create entanglement. Anything else can
    be built from these, and a longer palette makes the UI worse, not better.
    """

    H = "h"
    X = "x"
    Y = "y"
    Z = "z"
    S = "s"
    SDG = "sdg"
    T = "t"
    TDG = "tdg"
    RX = "rx"
    RY = "ry"
    RZ = "rz"
    CX = "cx"
    CZ = "cz"
    SWAP = "swap"

    @classmethod
    def parse(cls, raw: str | None) -> "GateKind | None":
        """Forgiving lookup, returning None rather than raising.

        Unlike the telemetry enums there is no UNKNOWN member: an unrecognised
        gate is not something we can render or execute, so callers must reject
        it rather than degrade.
        """
        if not raw:
            return None
        try:
            return cls(raw.strip().lower())
        except ValueError:
            return None


#: How many qubits each gate acts on. Two-qubit entries are ordered
#: ``[control, target]`` (``[a, b]`` for the symmetric SWAP and CZ).
GATE_ARITY: dict[GateKind, int] = {
    GateKind.H: 1,
    GateKind.X: 1,
    GateKind.Y: 1,
    GateKind.Z: 1,
    GateKind.S: 1,
    GateKind.SDG: 1,
    GateKind.T: 1,
    GateKind.TDG: 1,
    GateKind.RX: 1,
    GateKind.RY: 1,
    GateKind.RZ: 1,
    GateKind.CX: 2,
    GateKind.CZ: 2,
    GateKind.SWAP: 2,
}

#: Gates carrying a rotation angle in radians.
PARAMETERISED: frozenset[GateKind] = frozenset({GateKind.RX, GateKind.RY, GateKind.RZ})


class GateOp(BaseModel):
    """One gate applied to one or two qubits."""

    # Unlike the telemetry models, which parse IBM's payloads and must tolerate
    # fields we do not know about, this one parses *our own* browser's request.
    # An unrecognised key there is a bug, and silently dropping it would let a
    # typo'd circuit run as something the user did not build.
    model_config = ConfigDict(extra="forbid")

    kind: GateKind
    qubits: list[int] = Field(
        description="Target qubit indices; [control, target] for CX.",
        min_length=1,
        max_length=2,
    )
    parameter: float | None = Field(
        default=None, description="Rotation angle in radians; required for rx/ry/rz."
    )


class Circuit(BaseModel):
    """A complete circuit: a qubit count and an ordered list of gates.

    Validation lives here rather than in the endpoint because the simulate and
    submit paths must agree on exactly what a legal circuit is. A circuit that
    the simulator accepts but the hardware path rejects would be the worst kind
    of surprise -- discovered only after spending queue time.
    """

    model_config = ConfigDict(extra="forbid")

    qubits: int = Field(default=2, ge=1, le=MAX_CIRCUIT_QUBITS)
    ops: list[GateOp] = Field(default_factory=list, max_length=MAX_CIRCUIT_OPS)
    shots: int = Field(default=1024, ge=1, le=MAX_SHOTS)

    @model_validator(mode="after")
    def _validate_ops(self) -> "Circuit":
        for index, op in enumerate(self.ops):
            where = f"op {index} ({op.kind.value})"

            expected = GATE_ARITY[op.kind]
            if len(op.qubits) != expected:
                raise ValueError(
                    f"{where} acts on {expected} qubit(s), got {len(op.qubits)}."
                )

            for qubit in op.qubits:
                if not 0 <= qubit < self.qubits:
                    raise ValueError(
                        f"{where} targets qubit {qubit}, outside the circuit's "
                        f"0..{self.qubits - 1} range."
                    )

            if expected == 2 and op.qubits[0] == op.qubits[1]:
                raise ValueError(f"{where} needs two distinct qubits.")

            needs_parameter = op.kind in PARAMETERISED
            if needs_parameter and op.parameter is None:
                raise ValueError(f"{where} requires a rotation angle.")
            if not needs_parameter and op.parameter is not None:
                raise ValueError(f"{where} does not take a rotation angle.")

        return self

    @property
    def depth(self) -> int:
        """Gate count -- not true circuit depth, and named honestly for it.

        Deliberately *not* a computed_field. A circuit round-trips through JSON
        on its way to the browser, into SQLite and back; serialising a derived
        value that `extra="forbid"` then refuses to accept would break every one
        of those trips. The frontend has `ops.length` anyway.
        """
        return len(self.ops)


class AuthStatus(BaseModel):
    """Whether the door is locked, and whether this caller is through it."""

    enabled: bool = Field(description="False when no password is configured.")
    authenticated: bool


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    password: str = Field(min_length=1, max_length=256)


class CredentialSource(str, Enum):
    """Where the credentials currently in use came from."""

    ENVIRONMENT = "environment"
    RUNTIME = "runtime"
    NONE = "none"


class CredentialStatus(BaseModel):
    """What the dashboard will admit about its own credentials.

    Deliberately contains no secret: only a masked hint, so the UI can say
    "key ending 3f9a is loaded" without the response being worth intercepting.
    """

    configured: bool
    source: CredentialSource
    api_key_hint: str = ""
    crn_hint: str = ""
    api_url: str = ""
    validated_at: datetime | None = None
    last_error: str | None = None
    force_mock_mode: bool = False


class CredentialRequest(BaseModel):
    """Credentials submitted from the browser."""

    model_config = ConfigDict(extra="forbid")

    api_key: str = Field(min_length=1, max_length=512)
    crn: str = Field(min_length=1, max_length=512)
    api_url: str | None = Field(
        default=None,
        max_length=256,
        description="Override the regional endpoint, e.g. the eu-de host.",
    )

    @model_validator(mode="after")
    def _validate_shape(self) -> "CredentialRequest":
        # A pasted CRN is the single most common thing to get wrong, and IBM's
        # rejection for a malformed one is not self-explanatory.
        if not self.crn.strip().startswith("crn:"):
            raise ValueError(
                "That does not look like a Service CRN. It should start with 'crn:' -- "
                "copy it from your instance on quantum.cloud.ibm.com."
            )
        if self.api_url is not None and not self.api_url.strip().startswith("https://"):
            raise ValueError("The API URL must be an https:// endpoint.")
        return self


class SimulationMode(str, Enum):
    """How to execute a circuit.

    NOISY is the default because the point of comparison is what hardware
    actually returns, and an idealised histogram quietly misrepresents that.
    """

    NOISY = "noisy"
    IDEAL = "ideal"
    EXACT = "exact"


class ExecutionEngine(str, Enum):
    """Which simulator produced a result -- reported, never inferred."""

    AER = "aer"
    EXACT = "exact"


class SimulationResult(BaseModel):
    """Measurement counts from one execution of a circuit."""

    counts: dict[str, int] = Field(
        description="Bitstring -> occurrences. Qubit 0 is the rightmost character."
    )
    shots: int
    qubits: int
    source: TelemetrySource = TelemetrySource.MOCK
    engine: ExecutionEngine = ExecutionEngine.EXACT
    noisy: bool = False
    duration_ms: float = 0.0
    degraded_reason: str | None = Field(
        default=None,
        description="Set when the requested engine was unavailable and we fell back.",
    )
