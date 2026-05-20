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
