# Smart Attendance Management System

Production-oriented monorepo for a Smart Attendance Management System with three services:

- `frontend`: React + Parcel + JavaScript
- `backend`: Node.js + Express + JavaScript REST API
- `ai-service`: FastAPI service for ML/DL inference and experimentation
- `mongo`: MongoDB for the MERN data layer

## Why this architecture

The backend owns authentication, business rules, audit logging, MongoDB access, and integrations.
The AI service stays focused on inference and model lifecycle work.
The frontend talks to the backend over REST, and the backend talks to the AI service over REST.

## Project structure

```text
SAMS/
  frontend/
  backend/
  ai-service/
  shared/
    api-contracts/
  docs/
  docker-compose.yml
```

## Quick start

From the repo root you can start the frontend, backend, and AI service with:

```bash
npm run dev
```

If you prefer running each service separately, use the commands below.

For face enrollment and AI-backed attendance flows, start the AI service too:

```bash
npm run dev:ai
```

### Frontend

```bash
npm --workspace frontend install
npm run dev:frontend
```

Set `API_BASE_URL` in `frontend/.env` if your backend runs on a different URL.

### Backend

```bash
npm --workspace backend install
npm run dev:backend
```

If you want automatic reloads for backend code changes, use:

```bash
npm --workspace backend run dev:watch
```

### AI service

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### MongoDB

Use the `docker-compose.yml` file to run MongoDB locally with the rest of the stack.

## Runtime readiness

The AI service now exposes two different infrastructure states:

- `GET /health`
  process health plus model-readiness diagnostics
- `GET /ready`
  returns `200` only when the configured AI models are ready to serve inference

The backend mirrors this behavior on `GET /api/v1/health` and marks the stack as `degraded` if MongoDB or the AI runtime is not actually ready.

For production inference, make sure the following assets are available:

- Preferred InsightFace `antelopev2` files under `ai-service/data/model_assets/insightface/models/antelopev2/`, especially `scrfd_10g_bnkps.onnx` and `glintr100.onnx`. If those are not installed, the AI service falls back to the installed `buffalo_l` pack under `ai-service/data/model_assets/insightface/models/buffalo_l/`.

If the InsightFace pack is missing, the AI service will start but report `degraded` until the pack is downloaded once or mounted into that directory.

Hosted AI inference can take longer than local requests, especially when Render cold-starts the AI service or loads model assets for the first request. Set these backend environment variables in production:

```bash
AI_REQUEST_TIMEOUT_MS=120000
AI_HEALTH_TIMEOUT_MS=10000
AI_GATEWAY_RETRY_COUNT=1
FRONTEND_ORIGIN=https://markin-sams-frontend.vercel.app
```

## Recommended next steps

1. Add real Mongoose models, validation, and MongoDB-backed persistence in the backend.
2. Implement authentication with role-based access control.
3. Move AI enrollment/session persistence from local JSON files to a shared durable store.
4. Add event logging, attendance audit history, and reporting workflows.
