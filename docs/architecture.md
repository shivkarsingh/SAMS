# Architecture Notes

## Service boundaries

### Frontend

- React dashboard for admin, faculty, and students
- consumes REST endpoints from the backend only
- never directly owns ML model secrets or inference rules

### Backend

- source of truth for authentication and authorization
- owns attendance workflows and reporting APIs
- validates requests and forwards inference jobs to the AI service
- stores audit trails and future database writes

### AI service

- owns ML and DL model loading, inference, and experimentation
- exposes model metadata and prediction endpoints over REST
- should stay stateless where possible and read assets from mounted model storage

## Recommended technology choices

- frontend: React + Parcel + JavaScript
- backend: Express + Mongoose for a clean MERN backend
- AI service: FastAPI for fast iteration and clear OpenAPI docs
- database: MongoDB
- optional async layer: Redis later if queues or caching become necessary
- model serving: start with in-process inference, then move heavy models to dedicated workers if latency grows

## Suggested communication flow

```text
Frontend -> Backend REST API -> AI Service REST API
                             -> MongoDB
```

## Best model recommendations by capability

- Face recognition: ArcFace-style embeddings with teacher-reviewed attendance decisions
- Anomaly detection: Isolation Forest or autoencoder depending on feature richness and labeling
