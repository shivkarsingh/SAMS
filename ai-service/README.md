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

The service currently runs in `simulated` mode by default.

That means:

- the API flow is real
- the module structure is real
- enrollment and attendance session storage are real
- scores and embeddings are deterministic placeholders

This keeps the service testable before we attach the production CV model weights.

## Selected model stack

- Face detection: `SCRFD`
- Face tracking: `ByteTrack`
- Face recognition: `ArcFace`
- Active liveness: `MediaPipe Face Landmarker`
- Passive anti-spoof: `MiniFASNetV2`

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

Run the service:

```bash
uvicorn app.main:app --reload --port 8000
```

## Data files

Local development data is stored in:

- `data/enrolled_profiles.json`
- `data/attendance_sessions.json`

When we connect MongoDB later, this local storage layer can be replaced without changing the API routes.
