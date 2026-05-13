from typing import Any, Literal

from pydantic import BaseModel, Field


class ModelSummary(BaseModel):
    executionMode: str
    faceDetection: str
    faceTracking: str
    faceRecognition: str


class PersonReference(BaseModel):
    personId: str = Field(..., min_length=1)
    fullName: str = Field(..., min_length=1)


class EnrollmentRequest(BaseModel):
    personId: str = Field(..., min_length=1)
    fullName: str = Field(..., min_length=1)
    role: Literal["student", "teacher"]
    referenceImages: list[str] = Field(..., min_length=1)
    classIds: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class EnrollmentResponse(BaseModel):
    personId: str
    fullName: str
    role: str
    embeddingCount: int
    averageQualityScore: float
    faceModel: str
    executionMode: str
    storedAt: str
    notes: list[str]


class RecognizedStudent(BaseModel):
    trackId: str
    personId: str
    fullName: str
    confidence: float
    status: Literal["present-suggested", "manual-review"]
    frameHits: int
    evidenceCaptureIds: list[str]
    reasons: list[str] = Field(default_factory=list)


class UnknownDetection(BaseModel):
    trackId: str
    confidence: float
    frameHits: int
    evidenceCaptureIds: list[str]
    reasons: list[str]


class ReviewCandidate(BaseModel):
    trackId: str
    personId: str | None = None
    fullName: str | None = None
    confidence: float
    reasons: list[str]
    evidenceCaptureIds: list[str]


class AbsentStudent(BaseModel):
    personId: str
    fullName: str
    reason: str


class ClassroomRecognitionRequest(BaseModel):
    sessionId: str = Field(..., min_length=1)
    classId: str = Field(..., min_length=1)
    teacherId: str = Field(..., min_length=1)
    captureImages: list[str] = Field(..., min_length=1)
    classRoster: list[PersonReference] = Field(..., min_length=1)
    maxFaces: int = Field(100, ge=1, le=100)
    minimumTrackFrames: int = Field(2, ge=1, le=10)


class ClassroomRecognitionResponse(BaseModel):
    sessionId: str
    classId: str
    teacherId: str
    detectedFaceCount: int
    recognizedCount: int
    unknownCount: int
    lowConfidenceCount: int
    modelSummary: ModelSummary
    recognizedStudents: list[RecognizedStudent]
    unknownDetections: list[UnknownDetection]
    reviewQueue: list[ReviewCandidate]
    absentStudents: list[AbsentStudent]
    notes: list[str]


class AttendanceRecord(BaseModel):
    personId: str
    status: Literal["present", "absent"]
    source: Literal["ai-auto", "teacher-confirmed", "manual-add", "system-derived"]
    confidence: float | None = Field(default=None, ge=0, le=1)


class FinalizeAttendanceRequest(BaseModel):
    sessionId: str = Field(..., min_length=1)
    classId: str = Field(..., min_length=1)
    teacherId: str = Field(..., min_length=1)
    confirmedPresentIds: list[str] = Field(default_factory=list)
    manuallyAddedPresentIds: list[str] = Field(default_factory=list)
    rejectedTrackIds: list[str] = Field(default_factory=list)
    notes: str | None = None


class FinalizeAttendanceResponse(BaseModel):
    sessionId: str
    classId: str
    teacherId: str
    totalPresent: int
    totalAbsent: int
    presentIds: list[str]
    absentIds: list[str]
    finalizedAt: str
    notes: list[str]
    records: list[AttendanceRecord]


class FaceVerificationRequest(BaseModel):
    personId: str = Field(..., min_length=1)
    captureImages: list[str] = Field(..., min_length=1)


class FaceVerificationResponse(BaseModel):
    personId: str
    accepted: bool
    identityConfidence: float
    recommendedAction: Literal["allow", "retry-capture", "manual-review"]
    modelSummary: ModelSummary
    notes: list[str]


class SessionDetailsResponse(BaseModel):
    sessionId: str
    classId: str
    teacherId: str
    detectedFaceCount: int
    recognizedStudents: list[RecognizedStudent]
    unknownDetections: list[UnknownDetection]
    reviewQueue: list[ReviewCandidate]
    absentStudents: list[AbsentStudent]
    notes: list[str]
    finalizedAttendance: FinalizeAttendanceResponse | None = None
