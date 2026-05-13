from __future__ import annotations

from datetime import datetime, timezone

from app.core.config import settings
from app.pipelines.classroom_attendance_pipeline import ClassroomAttendancePipeline
from app.pipelines.enrollment_pipeline import EnrollmentPipeline
from app.pipelines.live_verification_pipeline import LiveVerificationPipeline
from app.schemas.attendance import FaceVerificationRequest
from app.schemas.legacy import LegacyFaceMatchRequest, LegacyFaceMatchResponse
from app.services.face_detection_service import FaceDetectionService
from app.services.face_recognition_service import FaceRecognitionService
from app.storage.enrollment_repository import EnrollmentRepository
from app.storage.json_file_store import JsonFileStore
from app.storage.session_repository import SessionRepository


class ServiceRegistry:
    def __init__(self) -> None:
        settings.data_dir.mkdir(parents=True, exist_ok=True)

        enrollment_store = JsonFileStore(
            settings.enrollment_store_path,
            default_value={"profiles": []},
        )
        session_store = JsonFileStore(
            settings.session_store_path,
            default_value={"sessions": []},
        )

        self.enrollment_repository = EnrollmentRepository(enrollment_store)
        self.session_repository = SessionRepository(session_store)

        self.face_recognition_service = FaceRecognitionService()
        self.face_detection_service = FaceDetectionService(self.face_recognition_service)

        self.enrollment_pipeline = EnrollmentPipeline(
            self.enrollment_repository,
            self.face_recognition_service,
        )
        self.classroom_attendance_pipeline = ClassroomAttendancePipeline(
            self.enrollment_repository,
            self.session_repository,
            self.face_detection_service,
            self.face_recognition_service,
        )
        self.live_verification_pipeline = LiveVerificationPipeline(
            self.enrollment_repository,
            self.face_recognition_service,
        )

    def legacy_face_match(
        self, payload: LegacyFaceMatchRequest
    ) -> LegacyFaceMatchResponse:
        verification = self.live_verification_pipeline.verify(
            FaceVerificationRequest(
                personId=payload.studentId,
                captureImages=[payload.imageUrl],
            )
        )

        return LegacyFaceMatchResponse(
            accepted=verification.accepted,
            confidence=verification.identityConfidence,
            model=self.face_recognition_service.active_face_recognition_model(),
            notes=(
                "Legacy face-match endpoint is mapped to identity-only face verification. "
                "Use /api/v1/attendance/classroom-recognition for classroom attendance."
            ),
        )

    def runtime_status(self, load_models: bool = True) -> dict:
        face_recognition = self.face_recognition_service.describe_runtime(
            load_models=load_models
        )

        return {
            "ready": bool(face_recognition.get("ready")),
            "executionMode": settings.execution_mode,
            "faceRecognition": face_recognition,
        }

    def health_report(self, load_models: bool = True) -> dict:
        runtime_status = self.runtime_status(load_models=load_models)
        warnings = [
            status["detail"]
            for key, status in runtime_status.items()
            if isinstance(status, dict) and key not in {"ready"}
            and status.get("detail")
        ]

        return {
            "status": "ok" if runtime_status["ready"] else "degraded",
            "ready": runtime_status["ready"],
            "executionMode": settings.execution_mode,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "checks": runtime_status,
            "warnings": warnings,
        }

    def warm_up_runtime(self) -> None:
        self.runtime_status(load_models=True)


service_registry = ServiceRegistry()
