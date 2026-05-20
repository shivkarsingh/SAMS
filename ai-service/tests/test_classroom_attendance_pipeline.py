import unittest

from fastapi import HTTPException

from app.models.domain import DetectedFaceTrack, EnrolledProfile, RecognitionOutcome
from app.pipelines.classroom_attendance_pipeline import ClassroomAttendancePipeline
from app.schemas.attendance import (
    ClassroomRecognitionRequest,
    FinalizeAttendanceRequest,
    PersonReference,
)


def profile(person_id, full_name):
    return EnrolledProfile(
        person_id=person_id,
        full_name=full_name,
        role="student",
        embedding=[1.0, 0.0],
        reference_embeddings=[],
        class_ids=["class-1"],
        average_quality_score=0.9,
        embedding_dimension=2,
        embedding_model="test-model",
        execution_mode="test",
    )


def track(track_id, hits=2, quality=0.9):
    return DetectedFaceTrack(
        track_id=track_id,
        embedding=[1.0, 0.0],
        source_capture_ids=["capture-001"],
        quality_score=quality,
        frame_hits=hits,
        bbox={"x": 0, "y": 0, "width": 100, "height": 100},
        flags=[],
    )


class FakeEnrollmentRepository:
    def __init__(self, profiles):
        self.profiles = {item.person_id: item for item in profiles}

    def list_profiles(self, person_ids):
        return [
            self.profiles[person_id]
            for person_id in person_ids
            if person_id in self.profiles
        ]


class FakeSessionRepository:
    def __init__(self):
        self.sessions = {}

    def save_session(self, session_record):
        self.sessions[session_record["sessionId"]] = session_record
        return session_record

    def get_session(self, session_id):
        return self.sessions.get(session_id)


class FakeFaceDetectionService:
    def __init__(self, tracks):
        self.tracks = tracks

    def detect_and_track_faces(self, _payload, _profiles_by_id):
        return self.tracks


class FakeFaceRecognitionService:
    def __init__(self, outcomes):
        self.outcomes = outcomes

    def is_profile_compatible(self, _profile):
        return True

    def match_track_to_profiles(self, current_track, _profiles):
        return self.outcomes[current_track.track_id]

    def active_face_detection_model(self):
        return "Fake detector"

    def active_face_recognition_model(self):
        return "Fake recognizer"


class ClassroomAttendancePipelineTests(unittest.TestCase):
    def make_pipeline(self, tracks, outcomes, profiles=None):
        self.session_repository = FakeSessionRepository()
        return ClassroomAttendancePipeline(
            FakeEnrollmentRepository(
                profiles
                if profiles is not None
                else [
                    profile("S1", "Student One"),
                    profile("S2", "Student Two"),
                    profile("S3", "Student Three"),
                ]
            ),
            self.session_repository,
            FakeFaceDetectionService(tracks),
            FakeFaceRecognitionService(outcomes),
        )

    def make_request(self, roster=None):
        return ClassroomRecognitionRequest(
            sessionId="session-1",
            classId="class-1",
            teacherId="T1",
            captureImages=["data:image/jpeg;base64,abc"],
            classRoster=roster
            if roster is not None
            else [
                PersonReference(personId="S1", fullName="Student One"),
                PersonReference(personId="S2", fullName="Student Two"),
                PersonReference(personId="S3", fullName="Student Three"),
            ],
        )

    def test_duplicate_roster_ids_are_rejected(self):
        pipeline = self.make_pipeline([], {})

        with self.assertRaises(HTTPException) as context:
            pipeline.process(
                self.make_request(
                    [
                        PersonReference(personId="S1", fullName="Student One"),
                        PersonReference(personId="S1", fullName="Student One"),
                    ]
                )
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("duplicate person ID", context.exception.detail)

    def test_strongest_duplicate_identity_wins_and_weaker_track_goes_to_review(self):
        pipeline = self.make_pipeline(
            [track("track-001"), track("track-002")],
            {
                "track-001": RecognitionOutcome(
                    track_id="track-001",
                    person_id="S1",
                    full_name="Student One",
                    confidence=0.91,
                    status="present-suggested",
                    frame_hits=2,
                    evidence_capture_ids=["capture-001"],
                    reasons=[],
                ),
                "track-002": RecognitionOutcome(
                    track_id="track-002",
                    person_id="S1",
                    full_name="Student One",
                    confidence=0.82,
                    status="present-suggested",
                    frame_hits=2,
                    evidence_capture_ids=["capture-001"],
                    reasons=[],
                ),
            },
        )

        response = pipeline.process(self.make_request())

        self.assertEqual(response.recognizedCount, 1)
        self.assertEqual(response.recognizedStudents[0].trackId, "track-001")
        self.assertEqual(response.lowConfidenceCount, 1)
        self.assertIn("stronger track", response.reviewQueue[0].reasons[-1])
        self.assertNotIn("S1", [student.personId for student in response.absentStudents])

    def test_successful_process_does_not_include_boilerplate_notes(self):
        pipeline = self.make_pipeline(
            [track("track-001")],
            {
                "track-001": RecognitionOutcome(
                    track_id="track-001",
                    person_id="S1",
                    full_name="Student One",
                    confidence=0.91,
                    status="present-suggested",
                    frame_hits=2,
                    evidence_capture_ids=["capture-001"],
                    reasons=[],
                )
            },
        )

        response = pipeline.process(self.make_request())

        self.assertEqual(response.notes, [])

    def test_process_notes_report_no_detected_faces(self):
        pipeline = self.make_pipeline([], {})

        response = pipeline.process(self.make_request())

        self.assertEqual(
            response.notes,
            [
                "No faces were detected. Use a clearer classroom image and run verification again."
            ],
        )

    def test_duplicate_review_confirmation_does_not_override_auto_source(self):
        pipeline = self.make_pipeline(
            [track("track-001"), track("track-002")],
            {
                "track-001": RecognitionOutcome(
                    track_id="track-001",
                    person_id="S1",
                    full_name="Student One",
                    confidence=0.94,
                    status="present-suggested",
                    frame_hits=2,
                    evidence_capture_ids=["capture-001"],
                    reasons=[],
                ),
                "track-002": RecognitionOutcome(
                    track_id="track-002",
                    person_id="S1",
                    full_name="Student One",
                    confidence=0.73,
                    status="manual-review",
                    frame_hits=1,
                    evidence_capture_ids=["capture-001"],
                    reasons=["Duplicate possible match"],
                ),
            },
        )
        pipeline.process(self.make_request())

        finalized = pipeline.finalize(
            FinalizeAttendanceRequest(
                sessionId="session-1",
                classId="class-1",
                teacherId="T1",
                confirmedPresentIds=["S1"],
            )
        )

        student_record = next(
            record for record in finalized.records if record.personId == "S1"
        )
        self.assertEqual(student_record.source, "ai-auto")
        self.assertIn("Teacher-confirmed additions: 0", finalized.notes)

    def test_review_candidate_can_be_confirmed_on_finalize(self):
        pipeline = self.make_pipeline(
            [track("track-001")],
            {
                "track-001": RecognitionOutcome(
                    track_id="track-001",
                    person_id="S2",
                    full_name="Student Two",
                    confidence=0.66,
                    status="manual-review",
                    frame_hits=1,
                    evidence_capture_ids=["capture-001"],
                    reasons=["Low confidence"],
                )
            },
        )
        pipeline.process(self.make_request())

        finalized = pipeline.finalize(
            FinalizeAttendanceRequest(
                sessionId="session-1",
                classId="class-1",
                teacherId="T1",
                confirmedPresentIds=["S2"],
            )
        )

        self.assertIn("S2", finalized.presentIds)
        self.assertEqual(
            next(record for record in finalized.records if record.personId == "S2").source,
            "teacher-confirmed",
        )

    def test_confirmed_ids_must_come_from_review_queue(self):
        pipeline = self.make_pipeline([], {})
        pipeline.process(self.make_request())

        with self.assertRaises(HTTPException) as context:
            pipeline.finalize(
                FinalizeAttendanceRequest(
                    sessionId="session-1",
                    classId="class-1",
                    teacherId="T1",
                    confirmedPresentIds=["S1"],
                )
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("review queue", context.exception.detail)

    def test_rejected_review_track_cannot_be_confirmed(self):
        pipeline = self.make_pipeline(
            [track("track-001")],
            {
                "track-001": RecognitionOutcome(
                    track_id="track-001",
                    person_id="S2",
                    full_name="Student Two",
                    confidence=0.69,
                    status="manual-review",
                    frame_hits=1,
                    evidence_capture_ids=["capture-001"],
                    reasons=["Low confidence"],
                )
            },
        )
        pipeline.process(self.make_request())

        with self.assertRaises(HTTPException) as context:
            pipeline.finalize(
                FinalizeAttendanceRequest(
                    sessionId="session-1",
                    classId="class-1",
                    teacherId="T1",
                    confirmedPresentIds=["S2"],
                    rejectedTrackIds=["track-001"],
                )
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("review queue", context.exception.detail)

    def test_manual_additions_are_roster_limited_and_do_not_override_ai_source(self):
        pipeline = self.make_pipeline(
            [track("track-001")],
            {
                "track-001": RecognitionOutcome(
                    track_id="track-001",
                    person_id="S1",
                    full_name="Student One",
                    confidence=0.93,
                    status="present-suggested",
                    frame_hits=2,
                    evidence_capture_ids=["capture-001"],
                    reasons=[],
                )
            },
        )
        pipeline.process(self.make_request())

        finalized = pipeline.finalize(
            FinalizeAttendanceRequest(
                sessionId="session-1",
                classId="class-1",
                teacherId="T1",
                manuallyAddedPresentIds=["S1", "S3"],
            )
        )

        records_by_id = {record.personId: record for record in finalized.records}
        self.assertEqual(records_by_id["S1"].source, "ai-auto")
        self.assertEqual(records_by_id["S3"].source, "manual-add")
        self.assertEqual(finalized.totalPresent, 2)

        with self.assertRaises(HTTPException) as context:
            pipeline.finalize(
                FinalizeAttendanceRequest(
                    sessionId="session-1",
                    classId="class-1",
                    teacherId="T1",
                    manuallyAddedPresentIds=["OUTSIDER"],
                )
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("class roster", context.exception.detail)

    def test_unknown_rejected_track_is_rejected(self):
        pipeline = self.make_pipeline([], {})
        pipeline.process(self.make_request())

        with self.assertRaises(HTTPException) as context:
            pipeline.finalize(
                FinalizeAttendanceRequest(
                    sessionId="session-1",
                    classId="class-1",
                    teacherId="T1",
                    rejectedTrackIds=["missing-track"],
                )
            )

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("not found", context.exception.detail)


if __name__ == "__main__":
    unittest.main()
