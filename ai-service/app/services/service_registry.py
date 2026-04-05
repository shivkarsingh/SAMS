from __future__ import annotations

from app.core.config import settings
from app.pipelines.classroom_attendance_pipeline import ClassroomAttendancePipeline
from app.pipelines.enrollment_pipeline import EnrollmentPipeline
from app.pipelines.live_verification_pipeline import LiveVerificationPipeline
from app.schemas.attendance import LivenessVerificationRequest
from app.schemas.legacy import LegacyFaceMatchRequest, LegacyFaceMatchResponse
from app.services.antispoof_service import AntiSpoofService
from app.services.face_detection_service import FaceDetectionService
from app.services.face_recognition_service import FaceRecognitionService
from app.services.liveness_service import LivenessService
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
        self.face_detection_service = FaceDetectionService(
            self.face_recognition_service
        )
        self.liveness_service = LivenessService()
        self.anti_spoof_service = AntiSpoofService()

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
            self.liveness_service,
            self.anti_spoof_service,
        )

    def legacy_face_match(
        self, payload: LegacyFaceMatchRequest
    ) -> LegacyFaceMatchResponse:
        verification = self.live_verification_pipeline.verify(
            LivenessVerificationRequest(
                personId=payload.studentId,
                captureImages=[payload.imageUrl],
                expectedMovements=["blink"],
            )
        )

        return LegacyFaceMatchResponse(
            accepted=verification.accepted,
            confidence=verification.identityConfidence,
            model=settings.face_recognition_model,
            notes=(
                "Legacy face-match endpoint is mapped to the live verification pipeline. "
                "Use /api/v1/attendance/classroom-recognition for classroom attendance."
            ),
        )


service_registry = ServiceRegistry()
