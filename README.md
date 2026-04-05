# Smart Attendance Management System

Starter monorepo for a Smart Attendance Management System with three services:

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

## Recommended next steps

1. Add real Mongoose models, validation, and MongoDB-backed persistence in the backend.
2. Implement authentication with role-based access control.
3. Replace placeholder AI responses with real face recognition and anomaly models.
4. Add event logging, attendance audit history, and reporting workflows.
