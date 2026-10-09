# IBM Quantum · Live Telemetry Dashboard

A real-time operations dashboard for the IBM Quantum QPU fleet — device status,
queue depth, live job flow, and a scored recommendation of **which quantum
computer to submit to right now**.

It runs out of the box with **zero credentials**, using a physically plausible
simulator. Supply an IBM Cloud API key and it streams live data from the real
IBM Quantum Compute Service REST API.

**Live demo: https://quantum-capstone.onrender.com** — hosted on Render's free
tier, so the first visit after 15 idle minutes takes about a minute to wake.

```bash
# Terminal 1 — backend
python3 -m venv .venv && ./.venv/bin/pip install -r backend/requirements.txt
./.venv/bin/python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173**. No configuration, no API key, no database setup.

---

## The problem

IBM rents time on real superconducting quantum processors. There are far more
researchers than machines, so you don't run your program — you join a queue.

That creates an ordinary operational problem: there are ~20 devices, some offline
for calibration, some with 3 jobs waiting and some with 400. Deciding where to
submit means clicking through IBM's portal one device at a time. There is no
single screen showing the whole fleet at once.

This is that screen.

Three real constraints shape the design:

| Constraint | Consequence |
|---|---|
| IBM tokens expire every hour | Something must re-authenticate silently and proactively, forever |
| The Runtime API is rate-limited per user | Request rate must be decoupled from viewer count |
| Networks and upstreams fail | A dashboard that shows a stack trace during a demo has failed |

---

## How it works

![System architecture](docs/architecture.svg)

**One background poller** hits IBM every 12 seconds and writes into an in-process
cache. Every browser, tab and REST caller reads that cache. IBM therefore sees a
**constant** request rate no matter how many people are watching — the single
most important property of the design.

**It cannot show an error.** Every snapshot carries a `source` field. If IBM
times out, rejects the token, or goes down for maintenance, the poller catches
it, substitutes simulated telemetry, stamps `source: "mock"` with a
human-readable reason, and the UI raises an amber banner. There is no error
screen and no blank state, because there is no error state to render.

Full design rationale, including what was rejected and why:
**[docs/architecture.md](docs/architecture.md)**.

---

## Features

- **Live QPU grid** — 18 devices, operational first then shortest queue, pulsing
  status dots, queue depth colour-coded by severity.
- **Fleet KPI bar** — devices online, qubits available, fleet-wide queue, median
  depth, jobs in flight.
- **Queue-depth chart** — the five busiest QPUs over time, seeded from stored
  history so it is populated on first paint rather than empty for a minute.
- **Smart recommender** — scores every operational device on queue depth (55%),
  throughput (25%) and qubit count (20%), normalised across the current fleet,
  and explains each ranking in a sentence.
- **Live job stream** — colour-coded status pills, relative timestamps, QPU
  charge time.
- **Honest mode indicator** — reflects the backend's actual `source`; it is a
  readout, not a switch the frontend could use to lie.
- **Gates playground** — build a circuit by clicking, run it on an exact local
  statevector simulator, and see the measurement histogram. See below.
- **Bring your own key** — paste an IBM API key and CRN straight into the
  dashboard; it re-authenticates the poller without a restart.
- **Password-protected** — one shared password gates the whole dashboard,
  playground, API and WebSocket. Off by default so localhost stays zero-config.
- **191 backend tests** covering token refresh, every IBM failure mode, the
  fallback guarantee, recommender ordering, and the simulator's physics.

---

## Gates playground

The **Playground** tab is a circuit workbench. Pick a gate, click a qubit, run
it — the histogram comes back in about a millisecond.

Like the dashboard, it needs **no credentials** — everything runs in the backend
process and contacts nothing.

### Three engines

| Engine | What it answers |
|---|---|
| **QPU noise** *(default)* | What real hardware would return. Qiskit Aer with a superconducting noise model, so a Bell pair lands on `01`/`10` a few percent of the time |
| **Ideal** | Aer with noise switched off — textbook probabilities plus shot noise |
| **Exact** | A dependency-free statevector simulator written from scratch; exact amplitudes |

The noisy default is the point: a playground that only ever shows `00` and `11`
teaches an idealisation, and the gap between the ideal and noisy histograms for
the same circuit is the most honest thing this app can show about quantum
hardware today.

The noise model is a documented approximation, not calibration data —
single-qubit depolarising at 2.5e-4, two-qubit at 7e-3, readout error just under
2%, and `rz` left free because on real hardware it is a frame change in software
rather than a pulse.

Keeping the hand-rolled exact simulator alongside Aer is deliberate: the two are
independent implementations, and the tests assert they agree. If our statevector
maths and Qiskit's produce the same distributions *and* the same bit ordering,
neither is quietly wrong. It also means a circuit still runs if Aer is missing.

- **Gates** — `H X Y Z S S† T T†`, the rotations `RX RY RZ`, and the two-qubit
  `CX CZ SWAP`. Up to 8 qubits, 4096 shots.
- **Placement** —
  **drag a gate onto a wire**, or click a gate then click a qubit. Existing
  gates drag sideways to reorder and click to delete. Both input methods are
  first-class: dragging is the natural mouse gesture, and the click path is the
  one that works on a touchscreen and from the keyboard.
- **Presets** — Bell pair, GHZ, uniform superposition, and an interference
  circuit, because typing out a Bell pair for the tenth time is a tax on demos.
- **Measurement is implicit.** Every qubit is measured at the end. Mid-circuit
  measurement would mean modelling classical registers and state collapse,
  which costs a lot and teaches nothing extra here.
- **Bitstrings read qubit 0 rightmost**, matching Qiskit and IBM. Diverging from
  that convention would make simulated and hardware results for the same
  circuit disagree while both looked reasonable.

Submission to real IBM hardware is the next phase; the button is present and
deliberately disabled until it is wired up.

---

## Bloch Lab

The **Bloch Lab** tab is one qubit you can take apart. Every gate is drawn as
what it physically is — a rotation of the sphere — so H visibly swings |0⟩
round the (x̂+ẑ)/√2 axis instead of teleporting to |+⟩.

- **Gates:** X Y Z H S S† T T†, Rx/Ry/Rz by any angle, a rotation about *any*
  axis (the axis is drawn as a ghost while you choose it), Qiskit's U(θ, φ, λ),
  or set θ/φ directly
- **Inspector:** probabilities, (x, y, z), θ/φ, the ket, the density matrix and
  its purity
- **Measure:** collapse the qubit with one shot, or sample thousands of fresh
  copies against the Born-rule prediction
- **Decoherence:** T1/T2 relaxation pulls the arrow *inside* the sphere — a
  mixed state no ket can describe. Presets are typical figures for each
  processor family, not live calibration (the IBM API does not report them)
- **Challenges:** ten "steer onto the ghost" puzzles with a gate budget and a
  live fidelity meter; progress is kept in the browser

## Algorithms

The **Algorithms** tab runs eight algorithms as a step-through debugger:
Bell state, teleportation, superdense coding, Deutsch–Jozsa,
Bernstein–Vazirani, Grover, the QFT and phase estimation.

Play, pause, scrub, or step with ← →. For every step you see:

- the circuit with a playhead
- the full statevector, where **bar height is |amplitude| and colour is its
  phase** — the sign flips that make Grover and Deutsch–Jozsa work are
  invisible in probabilities and obvious in colour
- one mini Bloch sphere per qubit, whose arrow **shrinks when the qubit
  becomes entangled** — entanglement you can see without any maths
- a plain-English account of what the step did, with the maths one click away,
  an analogy for the whole algorithm, and classical-vs-quantum query counts

Each algorithm has knobs — the marked item and number of Grover rounds (try
3 to watch it overshoot), the Bernstein–Vazirani secret, the Deutsch–Jozsa
oracle, the phase being estimated, the state to teleport.

Both tabs run **entirely in the browser**: a small statevector engine in
`frontend/src/quantum/`, three.js for the spheres, no network calls, no
backend. They keep working with uvicorn stopped, and fall back to a flat SVG
sphere on machines without WebGL. Adding a ninth algorithm is one file in
`frontend/src/components/algorithms/library/`.

## Bring your own key

Live mode no longer requires editing a file. Open **IBM credentials** on the
dashboard, paste an API key and a Service CRN, and press Connect. They are
verified against IBM before being accepted — a bad key is reported immediately
with IBM's own wording, and the dashboard carries on serving whatever it was
serving.

- **Memory only.** Nothing is written to disk. A restart reverts to `.env`.
- **Never echoed back.** Reads return a masked hint (`••••3f9a`), enough to
  confirm which key is loaded and useless to anyone who intercepts it.
- **No restart.** The poller rebuilds its IBM client in place and refreshes on
  the spot, clearing the auth latch — new credentials are exactly the new
  information that makes retrying worthwhile again.

> **Before you deploy this publicly:** set `ADMIN_PASSWORD` (below). Without it
> anyone who finds the URL can read your fleet data and point your instance at
> their own IBM account. On plain HTTP the key also crosses the network in clear
> text — Render terminates TLS for you, so prefer the deployed HTTPS URL over
> exposing a bare HTTP port.

---

## Authentication

One shared password, set on the server, exchanged for a signed session cookie.
There is no user table, no registration and no password reset: this protects one
person's instrument panel, and an identity system would be a larger attack
surface than the thing it guards.

```env
ADMIN_PASSWORD=something-long-and-random
SESSION_SECRET=               # blank = new random key each boot (signs everyone out)
SESSION_HOURS=12
```

- **Off by default.** With no password the dashboard behaves exactly as it
  always has — that keeps the zero-configuration promise for local use. The
  server logs a warning at startup when it starts up unprotected.
- **Everything is behind it** — the REST API, the playground, and the WebSocket.
  The WebSocket check is separate on purpose: an upgrade request never passes
  through HTTP middleware, so gating only the middleware would leave the socket
  streaming the whole fleet to anyone who asked.
- **`/api/health` stays open**, because a platform health check arrives with no
  cookie and a service that fails its health check is restarted forever.
- **The static bundle stays open**, because the login screen *is* the React app.
  Nothing sensitive is in the bundle; the data it renders is all gated.
- **Tokens are signed, not encrypted** — HMAC-SHA256 over a visible expiry,
  compared with `hmac.compare_digest`. stdlib only; no JWT dependency.
- **Throttled** — eight failed attempts from one address locks it out for five
  minutes, and the lockout blocks the correct password too, or it would not slow
  a search down at all.

---

## Enabling Live Mode

Mock mode is the default and needs nothing. For live IBM data:

### 1. Get an IBM Cloud API key

1. Sign in at **https://cloud.ibm.com**
2. Go to **Manage → Access (IAM) → API keys** (direct link:
   https://cloud.ibm.com/iam/apikeys)
3. **Create** → name it → **copy the key immediately** (it is shown once)

### 2. Find your Service CRN

1. Sign in at **https://quantum.cloud.ibm.com**
2. Open **Instances** and select your instance (create a free Open Plan instance
   if you have none)
3. Copy the **CRN**. It looks like:
   `crn:v1:bluemix:public:quantum-computing:us-east:a/abc123…::`

### 3. Configure

```bash
cp .env.example .env
```

Fill in the two values and restart the backend:

```env
IBM_QUANTUM_API_KEY=your-api-key-here
IBM_QUANTUM_CRN=crn:v1:bluemix:public:quantum-computing:us-east:a/...::
```

The mode indicator flips to **Live IBM QPU** on the next poll. If the credentials
are wrong, the dashboard keeps working on simulated data and tells you exactly
what IBM said.

> **EU region:** set `IBM_QUANTUM_API_URL=https://eu-de.quantum.cloud.ibm.com/api/v1`.

### Verifying credentials by hand

```bash
curl -s -X POST 'https://iam.cloud.ibm.com/identity/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=YOUR_API_KEY'
```

Take the `access_token` from the response and call:

```bash
curl -s 'https://quantum.cloud.ibm.com/api/v1/backends' \
  -H 'Accept: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Service-CRN: YOUR_CRN' \
  -H 'IBM-API-Version: 2024-01-01'
```

All three headers are required. Omitting `IBM-API-Version` is the most common
cause of an unexpected rejection.

---

## Configuration

Every setting has a working default; `.env` is only needed to change one.

| Variable | Default | Purpose |
|---|---|---|
| `IBM_QUANTUM_API_KEY` | *(blank)* | Blank ⇒ simulated telemetry |
| `IBM_QUANTUM_CRN` | *(blank)* | Instance CRN; both halves required |
| `IBM_QUANTUM_API_URL` | `https://quantum.cloud.ibm.com/api/v1` | Change for the EU region |
| `IBM_API_VERSION` | `2024-01-01` | Required request header; pin it |
| `POLL_INTERVAL_SECONDS` | `12` | **Values below 10 are rejected at startup** |
| `FORCE_MOCK_MODE` | `false` | Force simulation even with valid credentials |
| `ENABLE_HISTORY` | `true` | SQLite queue-depth history |
| `HISTORY_RETENTION_DAYS` | `7` | Rows older than this are pruned hourly |
| `ADMIN_PASSWORD` | *(blank)* | Blank ⇒ **no authentication**; set it before going public |
| `SESSION_SECRET` | *(blank)* | Blank ⇒ random per boot, so restarts sign everyone out |
| `SESSION_HOURS` | `12` | Session lifetime |

---

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/telemetry` | Current fleet snapshot (initial paint) |
| `GET /api/health` | Poller state, mode, connected clients |
| `GET /api/recommendations?min_qubits=100` | Ranked submission targets |
| `GET /api/history?minutes=60&backend=ibm_fez` | Stored queue depth |
| `GET /api/history/busiest?hours=24` | Average and peak depth per device |
| `WS /ws/telemetry` | Live snapshot stream |
| `POST /api/playground/simulate` | Run a circuit (`?mode=noisy\|ideal\|exact`) |
| `GET /api/credentials` | Which credentials are loaded, masked |
| `POST /api/credentials` | Verify and adopt credentials at runtime |
| `POST /api/credentials/clear` | Forget them and revert to `.env` |
| `GET /api/auth/status` | Whether auth is on, and whether you are through it |
| `POST /api/auth/login` | Exchange the password for a session cookie |
| `POST /api/auth/logout` | Clear the session |
| `GET /docs` | Interactive OpenAPI documentation |

---

## Tests

```bash
./.venv/bin/python -m pytest -q
cd frontend && npm test        # quantum engine + every algorithm and challenge
```

191 tests, a few seconds. They cover the claims this project makes rather than merely
exercising the code:

- Simulated queue depths **drift** rather than jump, so the chart is believable
- The poller returns a renderable fleet under **every** IBM failure mode
- A rejected API key latches, and its reason keeps being reported
- All three required IBM headers are sent
- IBM's nested `status` object and both job-status vocabularies parse correctly
- The recommender never ranks a swamped device above an idle one
- A Bell pair **never** measures 01 or 10, and two Hadamards cancel to 0 --
  claims a random-number generator dressed up as a simulator would fail
- Our bitstrings put qubit 0 rightmost, the same way IBM's do
- The hand-rolled simulator and Qiskit Aer agree -- on distributions **and** on
  bit ordering, which is what makes a hardware comparison meaningful
- The noise model errs at a rate real hardware would recognise, and more
  two-qubit gates means more error
- A forged, tampered or expired session cookie opens nothing -- and the
  WebSocket refuses it too, not just the REST API
- `/api/health` stays reachable without a session, so the platform health check
  cannot restart the service in a loop

The frontend suite (100 tests) runs every algorithm under every knob setting
and checks it produces its advertised answer, checks the QFT against its
textbook definition, checks every gate's sphere rotation against the matrix
maths, and proves each Bloch Lab challenge is solvable within its budget.

---

## Docker

```bash
docker compose up --build   # → http://localhost:8080
```

Two services, `backend` and `frontend`. No Redis and no Postgres — a
single-operator dashboard with one poller has nothing to share between processes.
SQLite history persists on a named volume.

Verified end-to-end on Docker 29.7.2 / Compose v5.5.1:

| Check | Result |
|---|---|
| Both images build | clean |
| Startup ordering | frontend waits on the backend's `HEALTHCHECK` before starting |
| REST through nginx | all 5 endpoints `200` |
| WebSocket upgrade through nginx | connects, `ping`/`pong`, pushes at exactly 12.0 s |
| **5 concurrent clients** | all 5 received **1 distinct snapshot** — one poll served every client |
| Client reaping | count returns to 0 on disconnect |
| SPA fallback | unknown routes serve `index.html` |
| Cache headers | `index.html` `no-cache`; hashed assets `immutable`, 1 year |
| gzip | active on JS/CSS |
| Container user | `appuser`, non-root |
| Volume persistence | history survived `docker compose restart`; simulator resumed from stored depths |
| Credential passthrough | a bad key in compose env reached IBM IAM, was rejected, and the dashboard still served `200` with 18 backends |
| Browser console | **no errors, no warnings** |

Credentials are passed at runtime and never baked into an image; `.dockerignore`
excludes `.env`, `node_modules`, `.venv` and `.git` from both build contexts.

---

## Deploying

`docker-compose.yml` runs two services, which suits a VPS. Hosting free tiers
generally allocate **one** service per app, so the root `Dockerfile` builds a
single container in which FastAPI serves the API, the WebSocket **and** the
built React bundle from one origin — which also removes CORS and WebSocket
proxying from the production path entirely.

```bash
docker build -t quantum-dashboard .
docker run -p 8000:8000 quantum-dashboard   # → http://localhost:8000
```

`PORT` is read from the environment, as hosting platforms assign it at runtime.

### Why not a serverless platform

This app needs a **stateful, long-lived process**: a background poller that
ticks every 12 seconds whether or not anyone is visiting, plus persistent
WebSocket connections fanned out from that process's in-memory cache. Serverless
functions terminate after responding, so there is nothing to hold either. Making
this run on serverless would mean abandoning the single-poller design — the one
thing that keeps the request rate to IBM constant. See
[docs/architecture.md](docs/architecture.md) §1.

A platform that runs containers as long-lived processes is therefore required.

### Render

`render.yaml` is a Blueprint: point Render at the repo and it configures the
service, health check and environment. Credentials are set in the dashboard, not
in the file.

The deployed instance is **https://quantum-capstone.onrender.com**. Render
redeploys it on every push to `main`.

The playground's dependencies are the heaviest thing in the image: qiskit, Aer,
numpy and scipy add roughly **175 MB**. Measured impact on the running service
is small — Aer is imported lazily on the first circuit run, and peak resident
memory with the whole stack loaded is about **98 MB** against the free tier's
512 MB. Build and cold-deploy times grow; the service itself is comfortable.

Two free-tier caveats worth planning around:

- **Spin-down.** Free services sleep after 15 minutes idle and take ~1 minute to
  wake. Before a demo, either open the link a couple of minutes early, or keep it
  warm by pinging `/api/health` every 10 minutes — 750 instance-hours per month
  is slightly more than a calendar month, so staying awake fits the allowance.
- **No persistent disk.** The SQLite history file resets on each deploy. The app
  handles this: the simulator re-bootstraps and the chart refills from the live
  stream.

---

## Project layout

```
backend/
  main.py                 app wiring + lifespan
  config.py               settings, rate-limit floor enforcement
  models.py               Pydantic domain types shared by live and mock paths
  mock_service.py         stateful fleet simulator
  core/
    simulator.py          exact statevector simulator, no dependencies
    aer_engine.py         qiskit-aer with a QPU noise model, lazily imported
    execution.py          engine selection + fallback
    credentials.py        runtime BYOK store, memory only
    auth.py               signed session tokens + login throttle
    ibm_client.py         IAM token cache, typed IBM REST calls
    poller.py             the single heartbeat + fallback decision
    cache.py              TTLCache snapshot store
    history.py            SQLite queue-depth log
    analytics.py          fleet summary + recommender
  static.py               serves the built frontend from the same process
  api/
    auth.py               login / logout / status
    rest.py               cache-reading REST endpoints
    websocket.py          fan-out to connected clients
  tests/                  191 tests
frontend/src/
  App.jsx                 layout, degraded banners
  hooks/useQuantumTelemetry.js   WebSocket + backoff reconnect + chart buffer
  components/             QPUCard, QueueChart, JobStream, ModeToggle,
                          FleetSummary, Recommender, ViewToggle
  components/playground/  CircuitGrid, GatePalette, ResultsHistogram
  components/bloch/       Bloch Lab: 3D sphere (+ SVG fallback), gates,
                          inspector, measurement, decoherence, challenges
  components/algorithms/  step-through debugger; library/ holds one file
                          per algorithm
  quantum/                in-browser statevector + Bloch geometry, tested
  components/CredentialsCard.jsx   bring-your-own-key form
  components/LoginScreen.jsx       the sign-in gate
docs/architecture.md      design rationale
Dockerfile                single-container image for deployment
docker-compose.yml        backend + frontend, no broker
render.yaml               Render Blueprint
.dockerignore             keeps secrets and node_modules out of build contexts
```

---

## Notes and limitations

- **Estimated wait is derived, not reported.** IBM's documented `/v1/backends`
  response has no wait-time field. The figure comes from queue depth, a nominal
  service time and processor speed, and is labelled as an estimate throughout.
- **`/v1/jobs` returns your account's jobs**, not a global feed — IBM exposes no
  public job stream. In simulated mode the job stream is synthetic.
- **Run one backend worker.** The design assumes one poller per process;
  multiple workers would multiply the request rate to IBM.
