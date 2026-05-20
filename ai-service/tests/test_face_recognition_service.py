import math
import unittest

from app.core.config import settings
from app.models.domain import DetectedFaceTrack, EnrolledProfile
from app.services.face_recognition_service import FaceRecognitionService


def embedding(first, second=0.0):
    values = [0.0 for _ in range(settings.face_embedding_dimensions)]
    values[0] = first
    if len(values) > 1:
        values[1] = second
    return values


def enrolled_profile(person_id, full_name, vector=None, model=None):
    return EnrolledProfile(
        person_id=person_id,
        full_name=full_name,
        role="student",
        embedding=vector or embedding(1.0),
        reference_embeddings=[],
        class_ids=["class-1"],
        average_quality_score=0.9,
        embedding_dimension=settings.face_embedding_dimensions,
        embedding_model=model or settings.face_recognition_model,
        execution_mode=settings.execution_mode,
    )


def detected_track(vector, quality=0.92, flags=None):
    return DetectedFaceTrack(
        track_id="track-001",
        embedding=vector,
        source_capture_ids=["capture-001"],
        quality_score=quality,
        frame_hits=2,
        bbox={"x": 0, "y": 0, "width": 100, "height": 100},
        flags=flags or [],
    )


class FaceRecognitionDecisionTests(unittest.TestCase):
    def make_service(self):
        service = FaceRecognitionService()
        service._face_app = object()
        service._active_model_pack = "test"
        service._active_face_recognition_model = settings.face_recognition_model
        return service

    def test_clear_high_confidence_match_is_auto_suggested(self):
        service = self.make_service()

        outcome = service.match_track_to_profiles(
            detected_track(embedding(1.0)),
            [enrolled_profile("S1", "Student One")],
        )

        self.assertEqual(outcome.status, "present-suggested")
        self.assertEqual(outcome.person_id, "S1")
        self.assertGreaterEqual(outcome.confidence, settings.recognition_threshold)

    def test_close_second_best_match_requires_teacher_review(self):
        service = self.make_service()
        best_similarity = settings.recognition_threshold + 0.06
        second_similarity = best_similarity - (settings.recognition_min_margin / 2)
        best_vector = embedding(
            best_similarity,
            math.sqrt(1 - (best_similarity * best_similarity)),
        )
        second_vector = embedding(
            second_similarity,
            math.sqrt(1 - (second_similarity * second_similarity)),
        )

        outcome = service.match_track_to_profiles(
            detected_track(embedding(1.0)),
            [
                enrolled_profile("S1", "Student One", best_vector),
                enrolled_profile("S2", "Student Two", second_vector),
            ],
        )

        self.assertEqual(outcome.status, "manual-review")
        self.assertEqual(outcome.person_id, "S1")
        self.assertTrue(
            any("more than one enrolled student" in reason for reason in outcome.reasons)
        )

    def test_low_quality_face_requires_teacher_review(self):
        service = self.make_service()

        outcome = service.match_track_to_profiles(
            detected_track(
                embedding(1.0),
                quality=settings.low_quality_face_threshold - 0.01,
                flags=["blurred-face"],
            ),
            [enrolled_profile("S1", "Student One")],
        )

        self.assertEqual(outcome.status, "manual-review")
        self.assertIn("Face quality", " ".join(outcome.reasons))

    def test_below_review_threshold_is_unknown(self):
        service = self.make_service()
        low_similarity = settings.review_threshold - 0.1

        outcome = service.match_track_to_profiles(
            detected_track(
                embedding(
                    low_similarity,
                    math.sqrt(1 - (low_similarity * low_similarity)),
                )
            ),
            [enrolled_profile("S1", "Student One")],
        )

        self.assertEqual(outcome.status, "unknown")
        self.assertIsNone(outcome.person_id)
        self.assertTrue(
            any("below the review threshold" in reason for reason in outcome.reasons)
        )

    def test_incompatible_enrollment_requires_reenrollment(self):
        service = self.make_service()

        outcome = service.match_track_to_profiles(
            detected_track(embedding(1.0)),
            [
                enrolled_profile(
                    "S1",
                    "Student One",
                    model="Old incompatible recognizer",
                )
            ],
        )

        self.assertEqual(outcome.status, "unknown")
        self.assertIsNone(outcome.person_id)
        self.assertTrue(
            any("Re-enrollment is required" in reason for reason in outcome.reasons)
        )


if __name__ == "__main__":
    unittest.main()
