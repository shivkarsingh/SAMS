from dataclasses import dataclass, field
from typing import Any


@dataclass
class EnrolledProfile:
    person_id: str
    full_name: str
    role: str
    embedding: list[float]
    reference_embeddings: list[list[float]]
    class_ids: list[str]
    average_quality_score: float
    metadata: dict[str, Any] = field(default_factory=dict)
    enrolled_at: str = ""
    updated_at: str = ""


@dataclass
class DetectedFaceTrack:
    track_id: str
    embedding: list[float]
    source_capture_ids: list[str]
    quality_score: float
    frame_hits: int
    bbox: dict[str, int]
    simulated_identity_key: str | None = None
    flags: list[str] = field(default_factory=list)


@dataclass
class RecognitionOutcome:
    track_id: str
    person_id: str | None
    full_name: str | None
    confidence: float
    status: str
    frame_hits: int
    evidence_capture_ids: list[str]
    reasons: list[str] = field(default_factory=list)
