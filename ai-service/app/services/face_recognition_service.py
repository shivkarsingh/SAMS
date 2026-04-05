from __future__ import annotations

from app.core.config import settings
from app.models.domain import DetectedFaceTrack, EnrolledProfile, RecognitionOutcome
from app.utils.vectors import (
    average_vectors,
    bounded_score,
    build_embedding_from_key,
    cosine_similarity,
    jitter_vector,
)


class FaceRecognitionService:
    def build_reference_embeddings(
        self, person_id: str, reference_images: list[str]
    ) -> tuple[list[list[float]], float]:
        embeddings = [
            build_embedding_from_key(f"enrollment::{person_id}::{image_ref}")
            for image_ref in reference_images
        ]

        quality_scores = [
            bounded_score(f"quality::{person_id}::{image_ref}", 0.84, 0.98)
            for image_ref in reference_images
        ]

        average_quality_score = round(sum(quality_scores) / len(quality_scores), 2)
        return embeddings, average_quality_score

    def build_average_embedding(self, embeddings: list[list[float]]) -> list[float]:
        return average_vectors(embeddings)

    def compare_embedding_to_profile(
        self,
        embedding: list[float],
        profile: EnrolledProfile,
    ) -> float:
        return round(cosine_similarity(embedding, profile.embedding), 2)

    def build_capture_embedding(
        self,
        track_key: str,
        source_capture_ids: list[str],
        enrolled_profile: EnrolledProfile | None = None,
        low_confidence: bool = False,
    ) -> list[float]:
        if enrolled_profile is None:
            joined_captures = "::".join(source_capture_ids)
            return build_embedding_from_key(f"unknown::{track_key}::{joined_captures}")

        jitter_scale = 0.62 if low_confidence else 0.08
        joined_captures = "::".join(source_capture_ids)
        return jitter_vector(
            enrolled_profile.embedding,
            f"track::{track_key}::{joined_captures}",
            scale=jitter_scale,
        )

    def match_track_to_profiles(
        self,
        track: DetectedFaceTrack,
        roster_profiles: list[EnrolledProfile],
    ) -> RecognitionOutcome:
        best_profile: EnrolledProfile | None = None
        best_similarity = -1.0

        for profile in roster_profiles:
            similarity = cosine_similarity(track.embedding, profile.embedding)
            if similarity > best_similarity:
                best_similarity = similarity
                best_profile = profile

        reasons: list[str] = []

        if best_profile is None:
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

        if "spoof-risk" in track.flags:
            reasons.append("Passive anti-spoof flagged this track for review.")

        if "blurred-face" in track.flags:
            reasons.append("Face quality is lower than the preferred capture standard.")

        if "low-confidence-match" in track.flags:
            reasons.append("Embedding confidence is intentionally lowered for manual review.")

        requires_review = (
            "spoof-risk" in track.flags
            or "blurred-face" in track.flags
            or "low-confidence-match" in track.flags
            or track.quality_score < 0.76
        )

        if best_similarity >= settings.recognition_threshold and not requires_review:
            status = "present-suggested"
        elif best_similarity >= settings.review_threshold:
            status = "manual-review"
            if requires_review:
                reasons.append("This detection needs manual confirmation before final attendance.")
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
