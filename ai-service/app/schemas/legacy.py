from pydantic import BaseModel, Field


class LegacyFaceMatchRequest(BaseModel):
    studentId: str = Field(..., min_length=1)
    classId: str = Field(..., min_length=1)
    imageUrl: str = Field(..., min_length=1)


class LegacyFaceMatchResponse(BaseModel):
    accepted: bool
    confidence: float
    model: str
    notes: str


class AttendanceRiskRequest(BaseModel):
    studentId: str = Field(..., min_length=1)
    attendancePercentage: float = Field(..., ge=0, le=100)
    recentAbsences: int = Field(..., ge=0)


class AttendanceRiskResponse(BaseModel):
    riskLevel: str
    score: float
    model: str
    notes: str
