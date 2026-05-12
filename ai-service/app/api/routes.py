from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.schemas.attendance import (
    ClassroomRecognitionRequest,
    ClassroomRecognitionResponse,
    EnrollmentRequest,
    EnrollmentResponse,
    FinalizeAttendanceRequest,
    FinalizeAttendanceResponse,
    LivenessVerificationRequest,
    LivenessVerificationResponse,
    SessionDetailsResponse,
)
from app.schemas.legacy import (
    AttendanceRiskRequest,
    AttendanceRiskResponse,
    LegacyFaceMatchRequest,
    LegacyFaceMatchResponse,
)
from app.services.risk_service import run_attendance_risk
from app.services.service_registry import service_registry

router = APIRouter(prefix="/api/v1")


@router.get("/models")
def list_models() -> dict:
    runtime_status = service_registry.runtime_status()
    return {
        "executionMode": settings.execution_mode,
        "faceDetection": settings.face_detection_model,
        "faceTracking": settings.face_tracking_model,
        "faceRecognition": settings.face_recognition_model,
        "liveness": settings.liveness_model,
        "antiSpoof": settings.anti_spoof_model,
        "attendanceRisk": settings.attendance_risk_model,
        "modelDevice": runtime_status["faceRecognition"].get("device", "unknown"),
        "faceRecognitionReady": runtime_status["faceRecognition"].get("ready", False),
        "livenessReady": runtime_status["liveness"].get("ready", False),
        "runtimeWarnings": [
            status["detail"]
            for status in runtime_status.values()
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
    "/verification/liveness",
    response_model=LivenessVerificationResponse,
)
def verify_liveness(
    payload: LivenessVerificationRequest,
) -> LivenessVerificationResponse:
    return service_registry.live_verification_pipeline.verify(payload)


@router.post("/inference/face-match", response_model=LegacyFaceMatchResponse)
def legacy_face_match(payload: LegacyFaceMatchRequest) -> LegacyFaceMatchResponse:
    return service_registry.legacy_face_match(payload)


@router.post("/inference/attendance-risk", response_model=AttendanceRiskResponse)
def attendance_risk(payload: AttendanceRiskRequest) -> AttendanceRiskResponse:
    return run_attendance_risk(payload)
