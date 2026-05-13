from __future__ import annotations

from app.core.config import settings
from app.schemas.attendance import (
    FaceVerificationRequest,
    FaceVerificationResponse,
    ModelSummary,
)


class LiveVerificationPipeline:
    def __init__(
        self,
        enrollment_repository,
        face_recognition_service,
    ) -> None:
        self.enrollment_repository = enrollment_repository
        self.face_recognition_service = face_recognition_service

    def verify(self, payload: FaceVerificationRequest) -> FaceVerificationResponse:
        enrolled_profile = self.enrollment_repository.get_profile(payload.personId)
        capture_result = self.face_recognition_service.build_capture_embedding(
            source_capture_ids=payload.captureImages,
        )

        if enrolled_profile is None:
            identity_confidence = 0.0
        elif not self.face_recognition_service.is_profile_compatible(enrolled_profile):
            identity_confidence = 0.0
        else:
            identity_confidence = self.face_recognition_service.compare_embedding_to_profile(
                embedding=capture_result.embedding,
                profile=enrolled_profile,
            )

        accepted = identity_confidence >= settings.recognition_threshold

        notes = [
            "Face verification used real InsightFace detection and ArcFace identity matching.",
        ]
        notes.extend(capture_result.warnings)
        if enrolled_profile is None:
            notes.append("No enrolled profile was found for the requested person ID.")
        elif not self.face_recognition_service.is_profile_compatible(enrolled_profile):
            notes.append(
                "The enrolled profile was created with an older or different embedding model. Re-enrollment is required before face verification can pass."
            )
        if enrolled_profile is not None and not accepted:
            notes.append(
                "Similarity is below the auto-accept threshold; capture a clearer image or send this to manual review."
            )

        recommended_action = "allow"
        if (
            not accepted
            and enrolled_profile is not None
            and not self.face_recognition_service.is_profile_compatible(enrolled_profile)
        ):
            recommended_action = "manual-review"
        elif not accepted:
            recommended_action = "retry-capture"

        return FaceVerificationResponse(
            personId=payload.personId,
            accepted=accepted,
            identityConfidence=round(identity_confidence, 2),
            recommendedAction=recommended_action,
            modelSummary=self._build_model_summary(),
            notes=notes,
        )

    def _build_model_summary(self) -> ModelSummary:
        return ModelSummary(
            executionMode=settings.execution_mode,
            faceDetection=self.face_recognition_service.active_face_detection_model(),
            faceTracking=settings.face_tracking_model,
            faceRecognition=self.face_recognition_service.active_face_recognition_model(),
        )
