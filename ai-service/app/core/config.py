import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
MPLCONFIG_DIR = DATA_DIR / ".matplotlib"
MPLCONFIG_DIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(MPLCONFIG_DIR))
os.environ.setdefault("NO_ALBUMENTATIONS_UPDATE", "1")
load_dotenv(BASE_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    service_port: int = int(os.getenv("AI_SERVICE_PORT", "8000"))
    execution_mode: str = os.getenv("AI_EXECUTION_MODE", "production").lower()
    face_detection_model: str = os.getenv(
        "FACE_DETECTION_MODEL", "SCRFD-10GF (InsightFace buffalo_l)"
    )
    face_tracking_model: str = os.getenv(
        "FACE_TRACKING_MODEL", "Embedding centroid tracker"
    )
    face_recognition_model: str = os.getenv(
        "FACE_RECOGNITION_MODEL", "ArcFace ResNet50@WebFace600K (InsightFace buffalo_l)"
    )
    liveness_model: str = os.getenv("LIVENESS_MODEL", "MediaPipe Face Landmarker v2")
    anti_spoof_model: str = os.getenv(
        "ANTI_SPOOF_MODEL", "Passive Spoof Risk Scorer"
    )
    attendance_risk_model: str = os.getenv(
        "ATTENDANCE_RISK_MODEL", "XGBoost placeholder"
    )
    model_device: str = os.getenv("MODEL_DEVICE", "auto").lower()
    image_download_timeout_seconds: float = float(
        os.getenv("IMAGE_DOWNLOAD_TIMEOUT_SECONDS", "10")
    )
    max_image_bytes: int = int(os.getenv("MAX_IMAGE_BYTES", "10485760"))
    face_crop_margin_ratio: float = float(
        os.getenv("FACE_CROP_MARGIN_RATIO", "0.18")
    )
    face_landmarker_asset_url: str = os.getenv(
        "FACE_LANDMARKER_ASSET_URL",
        "https://storage.googleapis.com/mediapipe-assets/face_landmarker_v2_with_blendshapes.task",
    )
    face_landmarker_asset_path: Path = Path(
        os.getenv(
            "FACE_LANDMARKER_ASSET_PATH",
            str(DATA_DIR / "model_assets" / "face_landmarker_v2_with_blendshapes.task"),
        )
    )
    face_landmarker_delegate: str = os.getenv(
        "FACE_LANDMARKER_DELEGATE", "cpu"
    ).lower()
    face_analysis_model_pack: str = os.getenv(
        "FACE_ANALYSIS_MODEL_PACK", "buffalo_l"
    )
    face_analysis_root: Path = Path(
        os.getenv(
            "FACE_ANALYSIS_ROOT",
            str(DATA_DIR / "model_assets" / "insightface"),
        )
    )
    face_analysis_providers: tuple[str, ...] = tuple(
        provider.strip()
        for provider in os.getenv("FACE_ANALYSIS_PROVIDERS", "auto").split(",")
        if provider.strip()
    )
    face_detection_input_size: int = int(
        os.getenv("FACE_DETECTION_INPUT_SIZE", "640")
    )
    tracking_similarity_threshold: float = float(
        os.getenv("TRACKING_SIMILARITY_THRESHOLD", "0.67")
    )
    low_quality_face_threshold: float = float(
        os.getenv("LOW_QUALITY_FACE_THRESHOLD", "0.58")
    )
    face_embedding_dimensions: int = int(
        os.getenv("FACE_EMBEDDING_DIMENSIONS", "512")
    )
    recognition_threshold: float = float(
        os.getenv("RECOGNITION_THRESHOLD", "0.72")
    )
    review_threshold: float = float(os.getenv("REVIEW_THRESHOLD", "0.62"))
    passive_spoof_threshold: float = float(
        os.getenv("PASSIVE_SPOOF_THRESHOLD", "0.62")
    )
    active_liveness_threshold: float = float(
        os.getenv("ACTIVE_LIVENESS_THRESHOLD", "0.55")
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
