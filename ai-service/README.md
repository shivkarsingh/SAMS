# SAMS AI Service

This service is the AI layer for the Smart Attendance Management System.

It is organized around the real attendance flow instead of one generic inference file:

- `app/api/`
  REST endpoints
- `app/pipelines/`
  business flow orchestration
- `app/services/`
  face recognition, liveness, anti-spoof, and detection logic
- `app/storage/`
  local JSON persistence for enrolled profiles and attendance sessions
- `app/schemas/`
  request and response contracts
- `app/models/`
  internal dataclasses used inside the service

## Current execution mode

The service now defaults to `production` mode.

That means:

- face enrollment uses real InsightFace detection plus ArcFace embeddings
- classroom recognition uses real multi-face detection and embedding matching
- live verification uses real face embeddings plus MediaPipe landmark liveness
- passive anti-spoofing uses image-signal scoring rather than deterministic placeholders

The old `simulated` mode still exists as a fallback for demos or dependency-free testing.

## Health and readiness

Use the service health endpoints during deployment and integration:

- `GET /health`
  returns process health, execution mode, and per-model readiness diagnostics
- `GET /ready`
  returns `200` only when the recognition and liveness runtimes are ready

This is important because the process can be alive while model assets are still missing or a delegate/runtime cannot initialize on the host machine.

## Selected model stack

- Face detection: `SCRFD-10GF (InsightFace buffalo_l)`
- Face tracking: `Embedding centroid tracker`
- Face recognition: `ArcFace ResNet50@WebFace600K (InsightFace buffalo_l)`
- Active liveness: `MediaPipe Face Landmarker v2`
- Passive anti-spoof: `Passive Spoof Risk Scorer`

## Main endpoints

- `POST /api/v1/faces/enroll`
- `POST /api/v1/attendance/classroom-recognition`
- `GET /api/v1/attendance/sessions/{sessionId}`
- `POST /api/v1/attendance/finalize`
- `POST /api/v1/verification/liveness`
- `GET /api/v1/models`

## Why classroom recognition and liveness are separate

Classroom attendance and liveness do not behave well as one single pipeline.

- Classroom attendance needs multi-face detection and recognition in wide shots.
- Liveness needs close-range face motion like blink and head movement.

So the design is:

- classroom mode for many students in one capture
- verification mode for suspicious or manual review cases

## Local development

Create the environment file:

```bash
cp .env.example .env
```

Install the dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run the service:

```bash
uvicorn app.main:app --reload --port 8000
```

On the first production run, InsightFace may download the `buffalo_l` model pack once, and the service may also fetch the official MediaPipe `face_landmarker_v2_with_blendshapes.task` asset if it is not already present.

If your environment cannot download assets at runtime, pre-populate:

- `data/model_assets/face_landmarker_v2_with_blendshapes.task`
- `data/model_assets/insightface/models/buffalo_l/`

The service will now report a degraded readiness state instead of silently pretending the models are available.

## Input expectations

- Enrollment works best with 3-6 clear single-face photos per person.
- Classroom recognition accepts either one clear group photo or multiple classroom frames; repeated views still improve confidence, but a single group image can now auto-mark attendance.
- Live verification should send a short ordered sequence of frames, not one still image, if blink and head movement are required.

## Re-enrollment after the upgrade

Profiles created in the older simulated mode or the older FaceNet production mode are not compatible with the current ArcFace embedding space.

- Existing students enrolled with the placeholder backend or the older FaceNet backend should be re-enrolled.
- The service now detects incompatible stored embeddings and reports that in response notes instead of silently matching against the wrong vector space.

## Data files

Local development data is stored in:

- `data/enrolled_profiles.json`
- `data/attendance_sessions.json`

When we connect MongoDB later, this local storage layer can be replaced without changing the API routes.
