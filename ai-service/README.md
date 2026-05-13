# SAMS AI Service

This service is the AI layer for the Smart Attendance Management System.

It is organized around the real attendance flow instead of one generic inference file:

- `app/api/`
  REST endpoints
- `app/pipelines/`
  business flow orchestration
- `app/services/`
  face detection, face tracking, and ArcFace recognition logic
- `app/storage/`
  local JSON persistence for enrolled profiles and attendance sessions
- `app/schemas/`
  request and response contracts
- `app/models/`
  internal dataclasses used inside the service

## Current execution mode

The service runs in `production` mode only.

That means:

- face enrollment uses real InsightFace detection plus ArcFace embeddings
- classroom recognition uses real multi-face detection and embedding matching
- classroom attendance uses real multi-face detection and face matching

The attendance flow should run in `production` mode for real face detection and matching.

## Health and readiness

Use the service health endpoints during deployment and integration:

- `GET /health`
  returns process health, execution mode, and face-recognition readiness diagnostics
- `GET /ready`
  returns `200` only when the face detection and recognition runtime is ready

This is important because the process can be alive while model assets are still missing or a delegate/runtime cannot initialize on the host machine.

## Selected model stack

- Preferred face model pack: `antelopev2`
- Installed fallback model pack: `buffalo_l`
- Face detection: `RetinaFace/SCRFD-10GF` from the active InsightFace pack
- Face tracking: `Embedding centroid tracker`
- Face recognition: `ArcFace ResNet100@Glint360K` when `antelopev2` is installed, otherwise `ArcFace ResNet50@WebFace600K` from `buffalo_l`
- No simulated recognition path is used.

## Main endpoints

- `POST /api/v1/faces/enroll`
- `POST /api/v1/attendance/classroom-recognition`
- `POST /api/v1/verification/face`
- `GET /api/v1/attendance/sessions/{sessionId}`
- `POST /api/v1/attendance/finalize`
- `GET /api/v1/models`

## Classroom Attendance Flow

The required production flow is intentionally simple:

- students enroll their face from the student dashboard
- the teacher uploads or captures one classroom photo
- InsightFace detects all visible faces in the photo
- ArcFace embeddings are matched only against students on that class roster
- matched students are suggested as present, and the remaining roster is shown as absent

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

On the first production run, InsightFace may download a model pack once when `FACE_ANALYSIS_AUTO_DOWNLOAD=true`. The Docker image pre-warms the same preferred `antelopev2` pack used locally, with `buffalo_l` available only as a real fallback, so hosted deployments can become ready without waiting for the first health check to fetch model files.

For hosted CPU deployments, use:

```bash
MODEL_DEVICE=cpu
FACE_ANALYSIS_PROVIDERS=CPUExecutionProvider
FACE_ANALYSIS_MODEL_PACK=antelopev2
FACE_ANALYSIS_MODEL_PACKS=antelopev2,buffalo_l
FACE_ANALYSIS_AUTO_DOWNLOAD=true
```

For smooth classroom use with the preferred model, pre-populate model files instead of relying on runtime download.

If your environment cannot download assets at runtime, pre-populate the preferred pack:

- `data/model_assets/insightface/models/antelopev2/scrfd_10g_bnkps.onnx`
- `data/model_assets/insightface/models/antelopev2/glintr100.onnx`

The service also supports the installed fallback pack:

- `data/model_assets/insightface/models/buffalo_l/det_10g.onnx`
- `data/model_assets/insightface/models/buffalo_l/w600k_r50.onnx`

The service reports the active model pack on `GET /api/v1/models`. If `antelopev2` is not installed, it falls back to `buffalo_l` instead of breaking classroom attendance.

## Input expectations

- Enrollment requires at least 3 usable single-face photos per person. The backend asks students for 6-10 images so the AI service can reject blurry, ambiguous, or multi-person frames and still keep enough evidence.
- Classroom recognition accepts one clear group photo. Multiple frames can improve confidence, but they are not required.
- Classroom recognition uses one-student-one-track assignment: if multiple detected faces match the same enrolled student, only the strongest track can be auto-suggested and the others go to manual review.
- Auto-attendance requires a clear margin over the next-best roster match; ambiguous matches are placed in manual review.
- Finalization only accepts roster member IDs, so a typo or out-of-class student cannot be written into the attendance records.

## Re-enrollment after the upgrade

Profiles created in the older simulated mode or the older FaceNet production mode are not compatible with the current ArcFace embedding space.

- Existing students enrolled with the placeholder backend or the older FaceNet backend should be re-enrolled.
- The service now detects incompatible stored embeddings and reports that in response notes instead of silently matching against the wrong vector space.

## Data files

Local development data is stored in:

- `data/enrolled_profiles.json`
- `data/attendance_sessions.json`

When we connect MongoDB later, this local storage layer can be replaced without changing the API routes.
