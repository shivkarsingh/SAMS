from __future__ import annotations

import math

from app.core.config import settings
from app.core.errors import ModelUnavailableError
from app.models.domain import DetectedFace
from app.schemas.attendance import LivenessSimulationHints, LivenessVerificationRequest
from app.utils.vectors import bounded_score, cosine_similarity


class AntiSpoofService:
    def __init__(self, face_recognition_service) -> None:
        self.face_recognition_service = face_recognition_service

    def evaluate(
        self, payload: LivenessVerificationRequest
    ) -> tuple[float, list[str]]:
        if settings.execution_mode == "simulated":
            return self._evaluate_simulated(payload), []

        detections: list[DetectedFace] = []
        warnings: list[str] = []

        for index, capture_image in enumerate(payload.captureImages):
            image_detections = self.face_recognition_service.detect_faces(
                capture_images=[capture_image],
                max_faces=3,
            )
            if not image_detections:
                warnings.append(f"Capture frame {index + 1} could not be used for passive spoof scoring.")
                continue

            detections.append(max(image_detections, key=self._primary_face_priority))

        if not detections:
            return 0.0, [
                "No usable face crop was available for passive spoof scoring."
            ]

        crop_scores = [self.score_detected_face(detection) for detection in detections]
        motion_score = self._sequence_motion_score(detections)
        final_score = round(
            max(
                0.0,
                min(
                    1.0,
                    (sum(crop_scores) / len(crop_scores) * 0.82) + (motion_score * 0.18),
                ),
            ),
            2,
        )

        return final_score, warnings

    def score_detected_face(self, detection: DetectedFace) -> float:
        try:
            import cv2
            import numpy as np
        except ImportError as exc:
            raise ModelUnavailableError(
                "Install opencv-python-headless and numpy to enable passive spoof scoring."
            ) from exc

        if detection.crop is None or detection.crop.size == 0:
            return 0.0

        gray = cv2.cvtColor(detection.crop, cv2.COLOR_RGB2GRAY)
        blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        sharpness_score = min(math.log1p(blur_variance) / 5.5, 1.0)
        contrast_score = min(float(np.std(gray) / 72.0), 1.0)
        brightness = float(np.mean(gray) / 255.0)
        exposure_score = 1.0 - min(abs(brightness - 0.52) / 0.52, 1.0)

        histogram, _ = np.histogram(gray, bins=32, range=(0, 256), density=True)
        entropy = float(-(histogram * np.log2(histogram + 1e-9)).sum())
        texture_score = min(entropy / 4.6, 1.0)

        specular_ratio = float(np.mean(gray > 245))
        highlight_penalty = min(specular_ratio * 8.0, 1.0)

        score = (
            0.22
            + (detection.detection_score * 0.12)
            + (sharpness_score * 0.23)
            + (contrast_score * 0.17)
            + (exposure_score * 0.14)
            + (texture_score * 0.12)
            - (highlight_penalty * 0.12)
        )
        return round(max(0.0, min(1.0, score)), 2)

    def _sequence_motion_score(self, detections: list[DetectedFace]) -> float:
        if len(detections) < 2:
            return 0.58

        similarity_deltas = [
            1.0 - max(0.0, cosine_similarity(detections[index - 1].embedding, detections[index].embedding))
            for index in range(1, len(detections))
        ]
        bbox_center_offsets = []
        for index in range(1, len(detections)):
            previous = detections[index - 1].bbox
            current = detections[index].bbox
            previous_center_x = previous["x"] + (previous["width"] / 2)
            current_center_x = current["x"] + (current["width"] / 2)
            bbox_center_offsets.append(abs(previous_center_x - current_center_x))

        mean_similarity_delta = sum(similarity_deltas) / len(similarity_deltas)
        mean_center_offset = sum(bbox_center_offsets) / len(bbox_center_offsets)
        movement_score = min((mean_center_offset / 24.0) + (mean_similarity_delta / 0.12), 1.0)
        return round(max(0.35, movement_score), 2)

    def _primary_face_priority(self, detection: DetectedFace) -> float:
        return (detection.quality_score * 0.85) + (detection.detection_score * 0.15)

    def _evaluate_simulated(self, payload: LivenessVerificationRequest) -> float:
        simulation_hints = payload.simulationHints or LivenessSimulationHints()

        if simulation_hints.passiveSpoofScore is not None:
            return round(simulation_hints.passiveSpoofScore, 2)

        joined = " ".join(payload.captureImages).lower()
        if "screen" in joined or "printed" in joined or "spoof" in joined:
            return 0.41

        return bounded_score(
            f"spoof::{payload.personId}::{'::'.join(payload.captureImages)}",
            0.81,
            0.96,
        )
