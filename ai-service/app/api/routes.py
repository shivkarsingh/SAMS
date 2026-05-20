from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.schemas.attendance import (
    ClassroomRecognitionRequest,
    ClassroomRecognitionResponse,
    EnrollmentRequest,
    EnrollmentResponse,
    FaceVerificationRequest,
    FaceVerificationResponse,
    FinalizeAttendanceRequest,
    FinalizeAttendanceResponse,
    SessionDetailsResponse,
)
from app.schemas.legacy import (
    LegacyFaceMatchRequest,
    LegacyFaceMatchResponse,
)
from app.services.service_registry import service_registry

router = APIRouter(prefix="/api/v1")


@router.get("/models")
def list_models() -> dict:
    runtime_status = service_registry.runtime_status()
    face_recognition_status = runtime_status.get("faceRecognition", {})
    return {
        "executionMode": settings.execution_mode,
        "modelPack": face_recognition_status.get("modelPack", "unknown"),
        "preferredModelPacks": face_recognition_status.get(
            "preferredModelPacks",
            list(settings.face_analysis_model_packs),
        ),
        "fallbackUsed": face_recognition_status.get("fallbackUsed", False),
        "faceDetection": face_recognition_status.get(
            "faceDetectionModel",
            settings.face_detection_model,
        ),
        "faceTracking": settings.face_tracking_model,
        "faceRecognition": face_recognition_status.get(
            "faceRecognitionModel",
            settings.face_recognition_model,
        ),
        "modelDevice": face_recognition_status.get("device", "unknown"),
        "ready": runtime_status.get("ready", False),
        "faceRecognitionReady": face_recognition_status.get("ready", False),
        "runtimeWarnings": [
            status["detail"]
            for status in runtime_status.values()
            if isinstance(status, dict)
            if status.get("detail")
        ],
    }


@router.post("/faces/enroll", response_model=EnrollmentResponse)
def enroll_face(payload: EnrollmentRequest) -> EnrollmentResponse:
    return service_registry.enrollment_pipeline.enroll(payload)


@router.post(
    "/attendance/classroom-recognition",
    response_model=ClassroomRecognitionResponse,
)
def classroom_recognition(
    payload: ClassroomRecognitionRequest,
) -> ClassroomRecognitionResponse:
    return service_registry.classroom_attendance_pipeline.process(payload)


@router.get(
    "/attendance/sessions/{session_id}",
    response_model=SessionDetailsResponse,
)
def get_attendance_session(session_id: str) -> SessionDetailsResponse:
    session_record = service_registry.session_repository.get_session(session_id)

    if session_record is None:
        raise HTTPException(status_code=404, detail="Attendance session not found.")

    return SessionDetailsResponse.model_validate(session_record)


@router.post(
    "/attendance/finalize",
    response_model=FinalizeAttendanceResponse,
)
def finalize_attendance(
    payload: FinalizeAttendanceRequest,
) -> FinalizeAttendanceResponse:
    return service_registry.classroom_attendance_pipeline.finalize(payload)


@router.post(
    "/verification/face",
    response_model=FaceVerificationResponse,
)
def verify_face(
    payload: FaceVerificationRequest,
) -> FaceVerificationResponse:
    return service_registry.live_verification_pipeline.verify(payload)


@router.post("/inference/face-match", response_model=LegacyFaceMatchResponse)
def legacy_face_match(payload: LegacyFaceMatchRequest) -> LegacyFaceMatchResponse:
    return service_registry.legacy_face_match(payload)
