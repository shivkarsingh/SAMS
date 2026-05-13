from __future__ import annotations

import math

from app.core.config import settings
from app.core.errors import ImageInputError, ModelUnavailableError
from app.models.domain import (
    CaptureEmbeddingResult,
    DetectedFace,
    DetectedFaceTrack,
    EmbeddingBatchResult,
    EnrolledProfile,
    RecognitionOutcome,
)
from app.utils.image_io import crop_image, describe_image_source, load_image
from app.utils.vectors import (
    average_vectors,
    cosine_similarity,
)

MODEL_PACK_METADATA = {
    "antelopev2": {
        "detection_model": "RetinaFace-10GF (InsightFace antelopev2)",
        "recognition_model": "ArcFace ResNet100@Glint360K (InsightFace antelopev2)",
        "required_files": ["scrfd_10g_bnkps.onnx", "glintr100.onnx"],
    },
    "buffalo_l": {
        "detection_model": "SCRFD-10GF (InsightFace buffalo_l)",
        "recognition_model": "ArcFace ResNet50@WebFace600K (InsightFace buffalo_l)",
        "required_files": ["det_10g.onnx", "w600k_r50.onnx"],
    },
}


class FaceRecognitionService:
    def __init__(self) -> None:
        self._face_app = None
        self._runtime_provider = "uninitialized"
        self._providers: list[str] = []
        self._active_model_pack = ""
        self._active_face_detection_model = settings.face_detection_model
        self._active_face_recognition_model = settings.face_recognition_model

    def active_model_pack(self) -> str:
        self._ensure_models()
        return self._active_model_pack

    def active_face_detection_model(self) -> str:
        self._ensure_models()
        return self._active_face_detection_model

    def active_face_recognition_model(self) -> str:
        self._ensure_models()
        return self._active_face_recognition_model

    def build_reference_embeddings(
        self, reference_images: list[str]
    ) -> EmbeddingBatchResult:
        if len(reference_images) < settings.min_reference_images:
            raise ImageInputError(
                "Enrollment requires at least "
                f"{settings.min_reference_images} reference images."
            )

        embeddings: list[list[float]] = []
        quality_scores: list[float] = []
        warnings: list[str] = []

        for index, image_ref in enumerate(reference_images):
            detections = self._extract_faces_from_source(
                image_ref=image_ref,
                capture_index=index,
                max_faces=4,
            )
            label = describe_image_source(image_ref, index)

            if not detections:
                warnings.append(f"{label}: no face detected, skipped.")
                continue

            if (
                len(detections) > 1
                and not settings.allow_multi_face_enrollment_images
            ):
                warnings.append(
                    f"{label}: multiple faces detected, skipped because enrollment images must contain one person."
                )
                continue

            if len(detections) > 1:
                warnings.append(
                    f"{label}: multiple faces detected, using the clearest face because multi-face enrollment images are allowed."
                )

            best_detection = max(detections, key=self._primary_face_score)
            if best_detection.quality_score < settings.enrollment_min_quality_score:
                warnings.append(
                    f"{label}: face quality score {best_detection.quality_score:.2f} is below the enrollment threshold, skipped."
                )
                continue

            embeddings.append(best_detection.embedding)
            quality_scores.append(best_detection.quality_score)

        if not embeddings:
            raise ImageInputError(
                "Enrollment failed because no usable face was detected in the reference images."
            )

        if len(embeddings) < settings.min_reference_images:
            raise ImageInputError(
                "Enrollment requires at least "
                f"{settings.min_reference_images} usable single-face images. "
                f"Only {len(embeddings)} passed detection and quality checks."
            )

        return EmbeddingBatchResult(
            embeddings=embeddings,
            average_quality_score=round(sum(quality_scores) / len(quality_scores), 2),
            warnings=warnings,
        )

    def build_average_embedding(self, embeddings: list[list[float]]) -> list[float]:
        return average_vectors(embeddings)

    def compare_embedding_to_profile(
        self,
        embedding: list[float],
        profile: EnrolledProfile,
    ) -> float:
        if not embedding or not self.is_profile_compatible(profile):
            return 0.0

        baseline_similarity = max(0.0, cosine_similarity(embedding, profile.embedding))
        reference_similarity = baseline_similarity
        if profile.reference_embeddings:
            reference_similarity = max(
                max(0.0, cosine_similarity(embedding, reference_embedding))
                for reference_embedding in profile.reference_embeddings
            )

        combined_similarity = (baseline_similarity * 0.65) + (
            reference_similarity * 0.35
        )
        return round(min(1.0, combined_similarity), 4)

    def build_capture_embedding(
        self,
        source_capture_ids: list[str],
    ) -> CaptureEmbeddingResult:
        detections: list[DetectedFace] = []
        warnings: list[str] = []

        for index, image_ref in enumerate(source_capture_ids):
            image_detections = self._extract_faces_from_source(
                image_ref=image_ref,
                capture_index=index,
                max_faces=4,
            )
            label = describe_image_source(image_ref, index)
            if not image_detections:
                warnings.append(f"{label}: no face detected, skipped.")
                continue

            if len(image_detections) > 1:
                warnings.append(
                    f"{label}: multiple faces detected, using the strongest face match candidate."
                )

            detections.append(max(image_detections, key=self._primary_face_score))

        if not detections:
            raise ImageInputError(
                "Verification failed because no usable face was detected in the capture images."
            )

        return CaptureEmbeddingResult(
            embedding=average_vectors([detection.embedding for detection in detections]),
            average_quality_score=round(
                sum(detection.quality_score for detection in detections)
                / len(detections),
                2,
            ),
            used_capture_ids=[detection.source_capture_id for detection in detections],
            warnings=warnings,
        )

    def detect_faces(
        self,
        capture_images: list[str],
        max_faces: int,
    ) -> list[DetectedFace]:
        detections: list[DetectedFace] = []
        for index, image_ref in enumerate(capture_images):
            if len(detections) >= max_faces:
                break

            remaining = max_faces - len(detections)
            detections.extend(
                self._extract_faces_from_source(
                    image_ref=image_ref,
                    capture_index=index,
                    max_faces=remaining,
                )
            )

        return detections[:max_faces]

    def is_profile_compatible(self, profile: EnrolledProfile | None) -> bool:
        if profile is None or not profile.embedding:
            return False

        stored_dimension = profile.embedding_dimension or len(profile.embedding)
        if stored_dimension != settings.face_embedding_dimensions:
            return False

        if profile.execution_mode and profile.execution_mode != settings.execution_mode:
            return False

        return profile.embedding_model == self.active_face_recognition_model()

    def match_track_to_profiles(
        self,
        track: DetectedFaceTrack,
        roster_profiles: list[EnrolledProfile],
    ) -> RecognitionOutcome:
        compatible_profiles = [
            profile for profile in roster_profiles if self.is_profile_compatible(profile)
        ]
        reasons: list[str] = []

        if not compatible_profiles and roster_profiles:
            return RecognitionOutcome(
                track_id=track.track_id,
                person_id=None,
                full_name=None,
                confidence=0.0,
                status="unknown",
                frame_hits=track.frame_hits,
                evidence_capture_ids=track.source_capture_ids,
                reasons=[
                    "Stored enrollments are incompatible with the current recognition model. Re-enrollment is required."
                ],
            )

        matches: list[tuple[float, EnrolledProfile]] = []

        for profile in compatible_profiles:
            similarity = self.compare_embedding_to_profile(track.embedding, profile)
            matches.append((similarity, profile))

        if not matches:
            return RecognitionOutcome(
                track_id=track.track_id,
                person_id=None,
                full_name=None,
                confidence=0.0,
                status="unknown",
                frame_hits=track.frame_hits,
                evidence_capture_ids=track.source_capture_ids,
                reasons=["No enrolled profile was available for matching."],
            )

        matches.sort(key=lambda match: match[0], reverse=True)
        best_similarity, best_profile = matches[0]
        second_best_similarity = matches[1][0] if len(matches) > 1 else None

        if second_best_similarity is not None:
            match_margin = best_similarity - second_best_similarity
            if match_margin < settings.recognition_min_margin:
                reasons.append(
                    "This face is close to more than one enrolled student, so teacher confirmation is required."
                )
        else:
            match_margin = None

        if "blurred-face" in track.flags:
            reasons.append("Face quality is below the preferred capture standard.")

        if "low-frame-hits" in track.flags:
            reasons.append(
                "The face was not observed across enough frames for auto-attendance."
            )

        requires_review = (
            "blurred-face" in track.flags
            or "low-frame-hits" in track.flags
            or track.quality_score < settings.low_quality_face_threshold
            or (
                match_margin is not None
                and match_margin < settings.recognition_min_margin
            )
        )

        if best_similarity >= settings.recognition_threshold and not requires_review:
            status = "present-suggested"
        elif best_similarity >= settings.review_threshold:
            status = "manual-review"
            if requires_review:
                reasons.append(
                    "This detection needs manual confirmation before final attendance."
                )
            else:
                reasons.append("Similarity is close but below the auto-accept threshold.")
        else:
            status = "unknown"
            reasons.append("Similarity is below the review threshold.")

        return RecognitionOutcome(
            track_id=track.track_id,
            person_id=best_profile.person_id if status != "unknown" else None,
            full_name=best_profile.full_name if status != "unknown" else None,
            confidence=round(best_similarity, 2),
            status=status,
            frame_hits=track.frame_hits,
            evidence_capture_ids=track.source_capture_ids,
            reasons=reasons,
        )

    def describe_runtime(self) -> dict:
        try:
            self._ensure_models()
        except ModelUnavailableError as exc:
            return {"ready": False, "device": "unavailable", "detail": exc.detail}

        return {
            "ready": True,
            "device": self._runtime_provider,
            "providers": self._providers,
            "modelPack": self._active_model_pack,
            "faceDetectionModel": self._active_face_detection_model,
            "faceRecognitionModel": self._active_face_recognition_model,
            "preferredModelPacks": list(settings.face_analysis_model_packs),
            "fallbackUsed": (
                bool(settings.face_analysis_model_packs)
                and self._active_model_pack != settings.face_analysis_model_packs[0]
            ),
        }

    def _extract_faces_from_source(
        self,
        image_ref: str,
        capture_index: int,
        max_faces: int,
    ) -> list[DetectedFace]:
        self._ensure_models()

        image = load_image(image_ref)
        image_bgr = image[:, :, ::-1].copy()
        faces = self._face_app.get(image_bgr)
        if not faces:
            return []

        detections: list[DetectedFace] = []
        for face in faces:
            bbox = self._clamp_bbox(face.bbox, image.shape)
            crop = crop_image(image, bbox, settings.face_crop_margin_ratio)
            detection_score = float(getattr(face, "det_score", 0.0))
            detections.append(
                DetectedFace(
                    source_capture_id=self._source_capture_id(capture_index),
                    capture_index=capture_index,
                    embedding=self._normalize_embedding(face.embedding),
                    bbox=bbox,
                    quality_score=self._score_face_quality(
                        crop=crop,
                        bbox=bbox,
                        detection_score=detection_score,
                        image_shape=image.shape,
                    ),
                    detection_score=round(detection_score, 2),
                    crop=crop,
                )
            )

        detections.sort(key=self._primary_face_score, reverse=True)
        return detections[:max_faces]

    def _score_face_quality(
        self,
        crop,
        bbox: dict[str, int],
        detection_score: float,
        image_shape: tuple[int, ...],
    ) -> float:
        try:
            import cv2
            import numpy as np
        except ImportError as exc:
            raise ModelUnavailableError(
                "Install opencv-python-headless and numpy to enable image quality scoring."
            ) from exc

        if crop.size == 0:
            return round(max(0.0, detection_score * 0.5), 2)

        gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
        blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        sharpness_score = min(math.log1p(blur_variance) / 5.7, 1.0)
        brightness = float(np.mean(gray) / 255.0)
        exposure_score = 1.0 - min(abs(brightness - 0.55) / 0.55, 1.0)
        contrast_score = min(float(np.std(gray) / 70.0), 1.0)
        image_area = max(1, image_shape[0] * image_shape[1])
        face_area = bbox["width"] * bbox["height"]
        area_ratio = face_area / image_area
        size_score = min(math.sqrt(area_ratio / 0.04), 1.0)

        quality_score = (
            (detection_score * 0.4)
            + (sharpness_score * 0.22)
            + (contrast_score * 0.16)
            + (exposure_score * 0.12)
            + (size_score * 0.1)
        )
        return round(max(0.0, min(1.0, quality_score)), 2)

    def _primary_face_score(self, detection: DetectedFace) -> float:
        return (detection.quality_score * 0.85) + (detection.detection_score * 0.15)

    def _source_capture_id(self, capture_index: int) -> str:
        return f"capture-{capture_index + 1:03d}"

    def _clamp_bbox(self, raw_bbox, image_shape: tuple[int, ...]) -> dict[str, int]:
        height, width = image_shape[:2]
        x1 = max(0, int(raw_bbox[0]))
        y1 = max(0, int(raw_bbox[1]))
        x2 = min(width, int(raw_bbox[2]))
        y2 = min(height, int(raw_bbox[3]))
        return {
            "x": x1,
            "y": y1,
            "width": max(1, x2 - x1),
            "height": max(1, y2 - y1),
        }

    def _ensure_models(self) -> None:
        if self._face_app is not None:
            return

        try:
            import onnxruntime as ort
            from insightface.app import FaceAnalysis
        except ImportError as exc:
            raise ModelUnavailableError(
                "Install insightface and onnxruntime to enable real face recognition."
            ) from exc

        try:
            resolved_providers = self._resolve_providers(ort)
            settings.face_analysis_root.mkdir(parents=True, exist_ok=True)
            load_errors: list[str] = []

            for providers in self._provider_attempts(resolved_providers):
                self._providers = providers
                for model_pack in settings.face_analysis_model_packs:
                    try:
                        self._load_model_pack(FaceAnalysis, model_pack)
                        return
                    except ModelUnavailableError as exc:
                        load_errors.append(exc.detail)
                    except Exception as exc:
                        self._face_app = None
                        load_errors.append(
                            "InsightFace model load failed. "
                            f"Pack: {model_pack}. "
                            f"Providers: {', '.join(providers)}. "
                            f"Detail: {exc}"
                        )

            raise ModelUnavailableError(
                "No configured InsightFace model pack could be loaded. "
                + " ".join(load_errors)
            )
        except ModelUnavailableError:
            raise
        except Exception as exc:
            raise ModelUnavailableError(
                "The InsightFace detection and recognition models could not be loaded. "
                f"Model packs: {', '.join(settings.face_analysis_model_packs)}. "
                f"Model root: {settings.face_analysis_root}. "
                f"Providers: {', '.join(self._providers) or 'unresolved'}. "
                "Allow the model pack to download once or pre-populate the InsightFace model directory."
            ) from exc

    def _provider_attempts(self, resolved_providers: list[str]) -> list[list[str]]:
        attempts = [resolved_providers]
        if (
            "CPUExecutionProvider" in resolved_providers
            and resolved_providers != ["CPUExecutionProvider"]
        ):
            attempts.append(["CPUExecutionProvider"])
        return attempts

    def _load_model_pack(self, face_analysis_class, model_pack: str) -> None:
        self._validate_model_pack_files(model_pack)

        face_app = face_analysis_class(
            name=model_pack,
            root=str(settings.face_analysis_root),
            allowed_modules=["detection", "recognition"],
            providers=self._providers,
        )
        face_app.prepare(
            ctx_id=self._resolve_ctx_id(),
            det_size=(
                settings.face_detection_input_size,
                settings.face_detection_input_size,
            ),
        )
        loaded_modules = set(face_app.models.keys())
        missing_modules = sorted({"detection", "recognition"} - loaded_modules)
        if missing_modules:
            model_dir = settings.face_analysis_root / "models" / model_pack
            raise ModelUnavailableError(
                "The InsightFace model pack is incomplete. "
                f"Pack: {model_pack}. "
                f"Missing module(s): {', '.join(missing_modules)}. "
                f"Expected model directory: {model_dir}."
            )

        metadata = MODEL_PACK_METADATA.get(model_pack, {})
        self._face_app = face_app
        self._active_model_pack = model_pack
        self._active_face_detection_model = metadata.get(
            "detection_model",
            f"InsightFace detection ({model_pack})",
        )
        self._active_face_recognition_model = metadata.get(
            "recognition_model",
            f"InsightFace recognition ({model_pack})",
        )
        self._runtime_provider = self._providers[0]

    def _validate_model_pack_files(self, model_pack: str) -> None:
        model_dir = settings.face_analysis_root / "models" / model_pack
        if not model_dir.exists():
            raise ModelUnavailableError(
                f"InsightFace model pack {model_pack} is not installed at {model_dir}."
            )

        required_files = MODEL_PACK_METADATA.get(model_pack, {}).get(
            "required_files",
            [],
        )
        missing_files = [
            file_name
            for file_name in required_files
            if not (model_dir / file_name).exists()
        ]
        if missing_files:
            raise ModelUnavailableError(
                f"InsightFace model pack {model_pack} is missing required file(s): "
                + ", ".join(missing_files)
                + f". Expected model directory: {model_dir}."
            )

    def _resolve_ctx_id(self) -> int:
        if self._providers and self._providers[0] == "CPUExecutionProvider":
            return -1
        return 0

    def _resolve_providers(self, ort) -> list[str]:
        available_providers = ort.get_available_providers()

        if (
            settings.face_analysis_providers
            and settings.face_analysis_providers != ("auto",)
        ):
            configured = [
                provider
                for provider in settings.face_analysis_providers
                if provider in available_providers
            ]
            if not configured:
                raise ModelUnavailableError(
                    "Configured InsightFace providers are not available in this runtime."
                )
            return configured

        preferred_providers: list[str]
        if settings.model_device == "cpu":
            preferred_providers = ["CPUExecutionProvider"]
        elif settings.model_device in {"mps", "coreml"}:
            preferred_providers = [
                "CoreMLExecutionProvider",
                "CPUExecutionProvider",
            ]
        elif settings.model_device == "cuda":
            preferred_providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        else:
            preferred_providers = [
                "CoreMLExecutionProvider",
                "CUDAExecutionProvider",
                "CPUExecutionProvider",
            ]

        resolved = [
            provider
            for provider in preferred_providers
            if provider in available_providers
        ]
        if resolved:
            return resolved

        if available_providers:
            return [available_providers[0]]

        raise ModelUnavailableError(
            "No ONNX Runtime execution providers are available for face recognition."
        )

    def _normalize_embedding(self, embedding) -> list[float]:
        try:
            import numpy as np
        except ImportError as exc:
            raise ModelUnavailableError(
                "Install numpy to normalize real face embeddings."
            ) from exc

        vector = np.asarray(embedding, dtype="float32")
        norm = float(np.linalg.norm(vector))
        if norm <= 0:
            return vector.tolist()

        return (vector / norm).tolist()
