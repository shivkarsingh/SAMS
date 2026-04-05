# Suggested Build Roadmap

## Phase 1

- finalize entities: users, roles, students, faculty, classes, departments, attendance sessions
- design the MongoDB collections and document relationships
- add auth and role-based access control
- replace placeholder summary values with Mongoose-backed queries

## Phase 2

- implement check-in methods: QR, manual, face-based
- add attendance verification flow and image upload strategy
- store attendance evidence and decision logs

## Phase 3

- evaluate and plug in face recognition model
- add liveness detection before enabling production face attendance
- train absenteeism risk and anomaly detection models

## Phase 4

- notifications
- reporting exports
- admin analytics
- model versioning and retraining workflows
