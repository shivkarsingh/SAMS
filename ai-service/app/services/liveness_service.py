from __future__ import annotations

import math

from app.core.config import settings
from app.core.errors import ModelUnavailableError
from app.schemas.attendance import LivenessSimulationHints, LivenessVerificationRequest
from app.utils.image_io import load_image


class LivenessService:
    def __init__(self) -> None:
        self._face_landmarker = None
        self._mediapipe = None

    def evaluate(
        self, payload: LivenessVerificationRequest
    ) -> tuple[bool, bool, float, list[str]]:
        if settings.execution_mode == "simulated":
            blink_detected, head_turn_detected, active_liveness_score = (
                self._evaluate_simulated(payload)
            )
            return blink_detected, head_turn_detected, active_liveness_score, []

        face_metrics: list[dict[str, float]] = []
        warnings: list[str] = []
        face_landmarker, mediapipe = self._ensure_face_landmarker()

        for index, capture_image in enumerate(payload.captureImages):
            image = load_image(capture_image)
            mp_image = mediapipe.Image(
                image_format=mediapipe.ImageFormat.SRGB,
                data=image,
            )
            result = face_landmarker.detect(mp_image)
            if not result.face_landmarks:
                warnings.append(
                    f"Capture frame {index + 1} could not be used for landmark-based liveness."
                )
                continue

            landmarks = result.face_landmarks[0]
            blendshape_scores = self._blendshape_scores(
                result.face_blendshapes[0] if result.face_blendshapes else []
            )
            face_metrics.append(
                {
                    "eye_ratio": self._eye_ratio(landmarks),
                    "yaw": self._yaw_metric(landmarks),
                    "pitch": self._pitch_metric(landmarks),
                    "blink_left": self._blendshape_score(
                        blendshape_scores,
                        "eye_blink_left",
                    ),
                    "blink_right": self._blendshape_score(
                        blendshape_scores,
                        "eye_blink_right",
                    ),
                }
            )

        if not face_metrics:
            return (
                False,
                False,
                0.0,
                ["No face landmarks could be extracted from the supplied capture frames."],
            )

        eye_ratios = [metric["eye_ratio"] for metric in face_metrics]
        yaw_values = [metric["yaw"] for metric in face_metrics]
        pitch_values = [metric["pitch"] for metric in face_metrics]
        blink_values = [
            max(metric["blink_left"], metric["blink_right"]) for metric in face_metrics
        ]

        blink_detected = self._detect_blink(eye_ratios, blink_values)
        head_turn_detected = self._detect_head_movement(
            yaw_values=yaw_values,
            pitch_values=pitch_values,
            expected_movements=payload.expectedMovements,
        )

        active_liveness_score = self._score_liveness(
            eye_ratios=eye_ratios,
            blink_values=blink_values,
            yaw_values=yaw_values,
            pitch_values=pitch_values,
            total_frames=len(payload.captureImages),
            usable_frames=len(face_metrics),
        )

        if len(face_metrics) < 2 and payload.expectedMovements:
            warnings.append(
                "Use at least 3 sequential face frames for more reliable active liveness."
            )

        return blink_detected, head_turn_detected, active_liveness_score, warnings

    def describe_runtime(self) -> dict:
        if settings.execution_mode == "simulated":
            return {"ready": True}

        try:
            self._ensure_face_landmarker()
        except ModelUnavailableError as exc:
            return {"ready": False, "detail": exc.detail}

        return {"ready": True}

    def _ensure_face_landmarker(self):
        if self._face_landmarker is not None and self._mediapipe is not None:
            return self._face_landmarker, self._mediapipe

        try:
            import mediapipe
            from mediapipe.tasks.python import vision
            from mediapipe.tasks.python.core.base_options import BaseOptions
        except ImportError as exc:
            raise ModelUnavailableError(
                "Install mediapipe to enable landmark-based active liveness."
            ) from exc

        model_asset_path = self._ensure_model_asset()

        try:
            base_options = BaseOptions(model_asset_path=str(model_asset_path))
            if settings.face_landmarker_delegate == "cpu":
                base_options.delegate = BaseOptions.Delegate.CPU
            elif settings.face_landmarker_delegate == "gpu":
                base_options.delegate = BaseOptions.Delegate.GPU

            options = vision.FaceLandmarkerOptions(
                base_options=base_options,
                output_face_blendshapes=True,
                output_facial_transformation_matrixes=False,
                num_faces=1,
            )
            self._face_landmarker = vision.FaceLandmarker.create_from_options(options)
        except Exception as exc:
            raise ModelUnavailableError(
                "The MediaPipe face landmarker could not be initialized with the configured model asset and delegate."
            ) from exc

        self._mediapipe = mediapipe
        return self._face_landmarker, self._mediapipe

    def _ensure_model_asset(self):
        model_asset_path = settings.face_landmarker_asset_path
        if model_asset_path.exists():
            return model_asset_path

        model_asset_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            import requests
        except ImportError as exc:
            raise ModelUnavailableError(
                "Install requests to automatically download the face-landmarker asset."
            ) from exc

        try:
            response = requests.get(
                settings.face_landmarker_asset_url,
                timeout=settings.image_download_timeout_seconds,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise ModelUnavailableError(
                "The face-landmarker asset is missing and could not be downloaded automatically."
            ) from exc

        model_asset_path.write_bytes(response.content)
        return model_asset_path

    def _blendshape_scores(self, categories) -> dict[str, float]:
        scores: dict[str, float] = {}
        for category in categories:
            if not getattr(category, "category_name", None):
                continue
            key = self._normalize_blendshape_name(category.category_name)
            scores[key] = float(category.score)
        return scores

    def _normalize_blendshape_name(self, name: str) -> str:
        return "".join(character for character in name.lower() if character.isalnum())

    def _blendshape_score(
        self,
        scores: dict[str, float],
        expected_name: str,
    ) -> float:
        return scores.get(self._normalize_blendshape_name(expected_name), 0.0)

    def _detect_blink(
        self,
        eye_ratios: list[float],
        blink_values: list[float],
    ) -> bool:
        if blink_values:
            blink_range = max(blink_values) - min(blink_values)
            if max(blink_values) > 0.45 and blink_range > 0.18:
                return True

        if len(eye_ratios) < 2:
            return eye_ratios[0] < 0.21 if eye_ratios else False

        ratio_range = max(eye_ratios) - min(eye_ratios)
        return min(eye_ratios) < 0.2 and ratio_range > 0.045

    def _detect_head_movement(
        self,
        yaw_values: list[float],
        pitch_values: list[float],
        expected_movements: list[str],
    ) -> bool:
        requires_horizontal = any(
            movement in {"turn_left", "turn_right"} for movement in expected_movements
        )
        requires_vertical = any(
            movement in {"look_up", "look_down"} for movement in expected_movements
        )

        yaw_range = max(yaw_values) - min(yaw_values) if yaw_values else 0.0
        pitch_range = max(pitch_values) - min(pitch_values) if pitch_values else 0.0

        if requires_horizontal and requires_vertical:
            return yaw_range > 0.12 or pitch_range > 0.08
        if requires_horizontal:
            return yaw_range > 0.12
        if requires_vertical:
            return pitch_range > 0.08

        return yaw_range > 0.12 or pitch_range > 0.08

    def _score_liveness(
        self,
        eye_ratios: list[float],
        blink_values: list[float],
        yaw_values: list[float],
        pitch_values: list[float],
        total_frames: int,
        usable_frames: int,
    ) -> float:
        eye_range = max(eye_ratios) - min(eye_ratios) if eye_ratios else 0.0
        blink_range = max(blink_values) - min(blink_values) if blink_values else 0.0
        yaw_range = max(yaw_values) - min(yaw_values) if yaw_values else 0.0
        pitch_range = max(pitch_values) - min(pitch_values) if pitch_values else 0.0

        blink_score = min(max((blink_range - 0.08) / 0.35, 0.0), 1.0)
        if blink_values and max(blink_values) > 0.45:
            blink_score = max(blink_score, 0.78)
        elif eye_ratios and min(eye_ratios) < 0.2:
            blink_score = max(blink_score, min(max((eye_range - 0.015) / 0.08, 0.0), 0.7))

        movement_score = max(
            min(yaw_range / 0.22, 1.0),
            min(pitch_range / 0.16, 1.0),
        )
        coverage_score = usable_frames / max(total_frames, 1)

        score = 0.15 + (blink_score * 0.45) + (movement_score * 0.28) + (
            coverage_score * 0.12
        )
        return round(min(1.0, max(0.0, score)), 2)

    def _eye_ratio(self, landmarks) -> float:
        left_eye = self._ear_from_indices(landmarks, [33, 160, 158, 133, 153, 144])
        right_eye = self._ear_from_indices(landmarks, [362, 385, 387, 263, 373, 380])
        return (left_eye + right_eye) / 2

    def _ear_from_indices(self, landmarks, indices: list[int]) -> float:
        p1 = landmarks[indices[0]]
        p2 = landmarks[indices[1]]
        p3 = landmarks[indices[2]]
        p4 = landmarks[indices[3]]
        p5 = landmarks[indices[4]]
        p6 = landmarks[indices[5]]

        horizontal = self._distance(p1, p4)
        if horizontal == 0:
            return 0.0

        vertical = self._distance(p2, p6) + self._distance(p3, p5)
        return vertical / (2 * horizontal)

    def _yaw_metric(self, landmarks) -> float:
        left_eye = landmarks[33]
        right_eye = landmarks[263]
        nose = landmarks[1]
        eye_center_x = (left_eye.x + right_eye.x) / 2
        inter_ocular = max(abs(right_eye.x - left_eye.x), 1e-6)
        return (nose.x - eye_center_x) / inter_ocular

    def _pitch_metric(self, landmarks) -> float:
        forehead = landmarks[10]
        nose = landmarks[1]
        chin = landmarks[152]
        face_height = max(abs(chin.y - forehead.y), 1e-6)
        normalized_nose = (nose.y - forehead.y) / face_height
        return normalized_nose - 0.5

    def _distance(self, left, right) -> float:
        return math.sqrt(((left.x - right.x) ** 2) + ((left.y - right.y) ** 2))

    def _evaluate_simulated(
        self, payload: LivenessVerificationRequest
    ) -> tuple[bool, bool, float]:
        simulation_hints = payload.simulationHints or LivenessSimulationHints()

        blink_detected = (
            simulation_hints.blinkDetected
            if simulation_hints.blinkDetected is not None
            else self._infer_blink(payload.captureImages)
        )
        head_turn_detected = (
            simulation_hints.headTurnDetected
            if simulation_hints.headTurnDetected is not None
            else self._infer_head_turn(payload.captureImages)
        )

        if simulation_hints.activeLivenessScore is not None:
            active_liveness_score = round(simulation_hints.activeLivenessScore, 2)
        else:
            success_ratio = (
                int(blink_detected) + int(head_turn_detected)
            ) / 2
            active_liveness_score = round(0.58 + (success_ratio * 0.35), 2)

        return blink_detected, head_turn_detected, active_liveness_score

    def _infer_blink(self, capture_images: list[str]) -> bool:
        joined = " ".join(capture_images).lower()
        if "no-blink" in joined:
            return False
        if "blink" in joined:
            return True
        return len(capture_images) >= 2

    def _infer_head_turn(self, capture_images: list[str]) -> bool:
        joined = " ".join(capture_images).lower()
        if "no-turn" in joined:
            return False
        if "turn-left" in joined or "turn-right" in joined or "head-turn" in joined:
            return True
        return len(capture_images) >= 3
