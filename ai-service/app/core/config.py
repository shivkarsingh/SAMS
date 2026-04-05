from dataclasses import dataclass
import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"


@dataclass(frozen=True)
class Settings:
    service_port: int = int(os.getenv("AI_SERVICE_PORT", "8000"))
    execution_mode: str = os.getenv("AI_EXECUTION_MODE", "simulated")
    face_detection_model: str = os.getenv("FACE_DETECTION_MODEL", "SCRFD")
    face_tracking_model: str = os.getenv("FACE_TRACKING_MODEL", "ByteTrack")
    face_recognition_model: str = os.getenv("FACE_RECOGNITION_MODEL", "ArcFace")
    liveness_model: str = os.getenv(
        "LIVENESS_MODEL", "MediaPipe Face Landmarker"
    )
    anti_spoof_model: str = os.getenv(
        "ANTI_SPOOF_MODEL", "MiniFASNetV2"
    )
    attendance_risk_model: str = os.getenv(
        "ATTENDANCE_RISK_MODEL", "XGBoost placeholder"
    )
    recognition_threshold: float = float(
        os.getenv("RECOGNITION_THRESHOLD", "0.83")
    )
    review_threshold: float = float(os.getenv("REVIEW_THRESHOLD", "0.74"))
    passive_spoof_threshold: float = float(
        os.getenv("PASSIVE_SPOOF_THRESHOLD", "0.75")
    )
    active_liveness_threshold: float = float(
        os.getenv("ACTIVE_LIVENESS_THRESHOLD", "0.72")
    )
    data_dir: Path = Path(os.getenv("AI_DATA_DIR", str(DATA_DIR)))
    enrollment_store_path: Path = Path(
        os.getenv(
            "ENROLLMENT_STORE_PATH", str(DATA_DIR / "enrolled_profiles.json")
        )
    )
    session_store_path: Path = Path(
        os.getenv(
            "SESSION_STORE_PATH", str(DATA_DIR / "attendance_sessions.json")
        )
    )


settings = Settings()
