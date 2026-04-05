from __future__ import annotations

from datetime import datetime, timezone

from app.core.config import settings
from app.models.domain import EnrolledProfile
from app.schemas.attendance import EnrollmentRequest, EnrollmentResponse


class EnrollmentPipeline:
    def __init__(self, enrollment_repository, face_recognition_service) -> None:
        self.enrollment_repository = enrollment_repository
        self.face_recognition_service = face_recognition_service

    def enroll(self, payload: EnrollmentRequest) -> EnrollmentResponse:
        reference_embeddings, average_quality_score = (
            self.face_recognition_service.build_reference_embeddings(
                payload.personId,
                payload.referenceImages,
            )
        )
        average_embedding = self.face_recognition_service.build_average_embedding(
            reference_embeddings
        )
        timestamp = datetime.now(timezone.utc).isoformat()

        profile = EnrolledProfile(
            person_id=payload.personId,
            full_name=payload.fullName,
            role=payload.role,
            embedding=average_embedding,
            reference_embeddings=reference_embeddings,
            class_ids=payload.classIds,
            average_quality_score=average_quality_score,
            metadata=payload.metadata,
            enrolled_at=timestamp,
            updated_at=timestamp,
        )
        self.enrollment_repository.upsert_profile(profile)

        notes = [
            "Enrollment profile stored successfully.",
            "Average embedding was created from all submitted reference images.",
        ]
        if settings.execution_mode == "simulated":
            notes.append(
                "The service is running in simulated mode, so embeddings are deterministic placeholders until model weights are attached."
            )

        return EnrollmentResponse(
            personId=payload.personId,
            fullName=payload.fullName,
            role=payload.role,
            embeddingCount=len(reference_embeddings),
            averageQualityScore=average_quality_score,
            faceModel=settings.face_recognition_model,
            executionMode=settings.execution_mode,
            storedAt=timestamp,
            notes=notes,
        )
