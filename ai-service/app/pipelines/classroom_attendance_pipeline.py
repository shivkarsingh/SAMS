from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.config import settings
from app.schemas.attendance import (
    AbsentStudent,
    AttendanceRecord,
    ClassroomRecognitionRequest,
    ClassroomRecognitionResponse,
    FinalizeAttendanceRequest,
    FinalizeAttendanceResponse,
    ModelSummary,
    RecognizedStudent,
    ReviewCandidate,
    UnknownDetection,
)


class ClassroomAttendancePipeline:
    def __init__(
        self,
        enrollment_repository,
        session_repository,
        face_detection_service,
        face_recognition_service,
    ) -> None:
        self.enrollment_repository = enrollment_repository
        self.session_repository = session_repository
        self.face_detection_service = face_detection_service
        self.face_recognition_service = face_recognition_service

    def process(
        self, payload: ClassroomRecognitionRequest
    ) -> ClassroomRecognitionResponse:
        roster_profiles = self.enrollment_repository.list_profiles(
            [student.personId for student in payload.classRoster]
        )
        roster_profiles_by_id = {
            profile.person_id: profile for profile in roster_profiles
        }

        tracks = self.face_detection_service.detect_and_track_faces(
            payload,
            roster_profiles_by_id,
        )

        recognized_students: list[RecognizedStudent] = []
        unknown_detections: list[UnknownDetection] = []
        review_queue: list[ReviewCandidate] = []
        auto_present_ids: list[str] = []

        for track in tracks:
            outcome = self.face_recognition_service.match_track_to_profiles(
                track,
                roster_profiles,
            )

            if outcome.status == "present-suggested" and outcome.person_id and outcome.full_name:
                recognized_students.append(
                    RecognizedStudent(
                        trackId=outcome.track_id,
                        personId=outcome.person_id,
                        fullName=outcome.full_name,
                        confidence=outcome.confidence,
                        status="present-suggested",
                        frameHits=outcome.frame_hits,
                        evidenceCaptureIds=outcome.evidence_capture_ids,
                        reasons=outcome.reasons,
                    )
                )
                auto_present_ids.append(outcome.person_id)
                continue

            if outcome.status == "manual-review":
                review_queue.append(
                    ReviewCandidate(
                        trackId=outcome.track_id,
                        personId=outcome.person_id,
                        fullName=outcome.full_name,
                        confidence=outcome.confidence,
                        reasons=outcome.reasons,
                        evidenceCaptureIds=outcome.evidence_capture_ids,
                    )
                )
                if outcome.person_id and outcome.full_name:
                    recognized_students.append(
                        RecognizedStudent(
                            trackId=outcome.track_id,
                            personId=outcome.person_id,
                            fullName=outcome.full_name,
                            confidence=outcome.confidence,
                            status="manual-review",
                            frameHits=outcome.frame_hits,
                            evidenceCaptureIds=outcome.evidence_capture_ids,
                            reasons=outcome.reasons,
                        )
                    )
                continue

            unknown_detections.append(
                UnknownDetection(
                    trackId=outcome.track_id,
                    confidence=outcome.confidence,
                    frameHits=outcome.frame_hits,
                    evidenceCaptureIds=outcome.evidence_capture_ids,
                    reasons=outcome.reasons,
                )
            )

        auto_present_set = set(auto_present_ids)
        absent_students = [
            AbsentStudent(
                personId=student.personId,
                fullName=student.fullName,
                reason="Student was not auto-recognized in the classroom capture.",
            )
            for student in payload.classRoster
            if student.personId not in auto_present_set
        ]

        notes = [
            "Classroom capture processed successfully.",
            "Recognition is restricted to the roster sent with this class session.",
        ]

        missing_enrollments = [
            student.fullName
            for student in payload.classRoster
            if student.personId not in roster_profiles_by_id
        ]
        if missing_enrollments:
            notes.append(
                "Some roster members do not have enrolled face profiles yet: "
                + ", ".join(missing_enrollments)
            )
        if settings.execution_mode == "simulated":
            notes.append(
                "The AI service is currently running with deterministic simulated embeddings until the production CV models are attached."
            )

        response = ClassroomRecognitionResponse(
            sessionId=payload.sessionId,
            classId=payload.classId,
            teacherId=payload.teacherId,
            detectedFaceCount=len(tracks),
            recognizedCount=len([student for student in recognized_students if student.status == "present-suggested"]),
            unknownCount=len(unknown_detections),
            lowConfidenceCount=len(review_queue),
            modelSummary=self._build_model_summary(),
            recognizedStudents=recognized_students,
            unknownDetections=unknown_detections,
            reviewQueue=review_queue,
            absentStudents=absent_students,
            notes=notes,
        )

        session_record = response.model_dump()
        session_record["roster"] = [student.model_dump() for student in payload.classRoster]
        session_record["autoPresentIds"] = auto_present_ids
        session_record["captureImages"] = payload.captureImages
        session_record["finalizedAttendance"] = None
        self.session_repository.save_session(session_record)

        return response

    def finalize(
        self, payload: FinalizeAttendanceRequest
    ) -> FinalizeAttendanceResponse:
        session_record = self.session_repository.get_session(payload.sessionId)
        if session_record is None:
            raise HTTPException(status_code=404, detail="Attendance session not found.")

        if session_record["classId"] != payload.classId or session_record["teacherId"] != payload.teacherId:
            raise HTTPException(
                status_code=400,
                detail="Session details do not match the class or teacher provided.",
            )

        rejected_track_ids = set(payload.rejectedTrackIds)
        recognized_students = session_record.get("recognizedStudents", [])
        auto_present_ids = {
            student["personId"]
            for student in recognized_students
            if student["status"] == "present-suggested"
            and student["trackId"] not in rejected_track_ids
        }
        confirmed_present_ids = set(payload.confirmedPresentIds)
        manually_added_present_ids = set(payload.manuallyAddedPresentIds)
        present_ids = sorted(
            auto_present_ids | confirmed_present_ids | manually_added_present_ids
        )

        roster = session_record.get("roster", [])
        roster_ids = {student["personId"] for student in roster}
        absent_ids = sorted(roster_ids - set(present_ids))
        timestamp = datetime.now(timezone.utc).isoformat()

        source_by_person_id: dict[str, str] = {}
        for student in recognized_students:
            if student["status"] == "present-suggested" and student["trackId"] not in rejected_track_ids:
                source_by_person_id[student["personId"]] = "ai-auto"

        for person_id in payload.confirmedPresentIds:
            source_by_person_id[person_id] = "teacher-confirmed"

        for person_id in payload.manuallyAddedPresentIds:
            source_by_person_id[person_id] = "manual-add"

        records = [
            AttendanceRecord(
                personId=person_id,
                status="present",
                source=source_by_person_id.get(person_id, "teacher-confirmed"),
            )
            for person_id in present_ids
        ]
        records.extend(
            AttendanceRecord(
                personId=person_id,
                status="absent",
                source="system-derived",
            )
            for person_id in absent_ids
        )

        notes = [
            "Attendance session finalized successfully.",
            f"Auto-present records accepted: {len(auto_present_ids)}",
            f"Teacher-confirmed additions: {len(confirmed_present_ids)}",
            f"Manual additions: {len(manually_added_present_ids)}",
        ]
        if payload.notes:
            notes.append(payload.notes)

        finalized_attendance = FinalizeAttendanceResponse(
            sessionId=payload.sessionId,
            classId=payload.classId,
            teacherId=payload.teacherId,
            totalPresent=len(present_ids),
            totalAbsent=len(absent_ids),
            presentIds=present_ids,
            absentIds=absent_ids,
            finalizedAt=timestamp,
            notes=notes,
            records=records,
        )

        session_record["finalizedAttendance"] = finalized_attendance.model_dump()
        self.session_repository.save_session(session_record)
        return finalized_attendance

    def _build_model_summary(self) -> ModelSummary:
        return ModelSummary(
            executionMode=settings.execution_mode,
            faceDetection=settings.face_detection_model,
            faceTracking=settings.face_tracking_model,
            faceRecognition=settings.face_recognition_model,
            liveness=settings.liveness_model,
            antiSpoof=settings.anti_spoof_model,
        )
