from __future__ import annotations

from app.models.domain import DetectedFaceTrack, EnrolledProfile
from app.schemas.attendance import ClassroomRecognitionRequest, ClassroomSimulationHints
from app.utils.vectors import bounded_score


class FaceDetectionService:
    def __init__(self, face_recognition_service) -> None:
        self.face_recognition_service = face_recognition_service

    def detect_and_track_faces(
        self,
        payload: ClassroomRecognitionRequest,
        roster_profiles_by_id: dict[str, EnrolledProfile],
    ) -> list[DetectedFaceTrack]:
        simulation_hints = payload.simulationHints or ClassroomSimulationHints()
        visible_roster_ids = self._resolve_visible_roster_ids(payload, simulation_hints)
        tracks: list[DetectedFaceTrack] = []

        for index, roster_id in enumerate(visible_roster_ids[: payload.maxFaces], start=1):
            profile = roster_profiles_by_id.get(roster_id)
            low_confidence = roster_id in simulation_hints.lowConfidenceRosterIds
            blurred = roster_id in simulation_hints.blurredRosterIds
            spoofed = roster_id in simulation_hints.spoofedRosterIds
            quality_floor = 0.58 if blurred else 0.79
            quality_ceiling = 0.75 if blurred else 0.97
            quality_score = bounded_score(
                f"classroom-quality::{payload.sessionId}::{roster_id}",
                quality_floor,
                quality_ceiling,
            )
            frame_hits = max(
                payload.minimumTrackFrames,
                min(len(payload.captureImages), 4),
            )

            flags: list[str] = []
            if low_confidence:
                flags.append("low-confidence-match")
            if blurred:
                flags.append("blurred-face")
            if spoofed:
                flags.append("spoof-risk")

            track = DetectedFaceTrack(
                track_id=f"track-{index:03d}",
                embedding=self.face_recognition_service.build_capture_embedding(
                    track_key=f"{payload.sessionId}::{roster_id}",
                    source_capture_ids=payload.captureImages,
                    enrolled_profile=profile,
                    low_confidence=low_confidence,
                ),
                source_capture_ids=payload.captureImages,
                quality_score=quality_score,
                frame_hits=frame_hits,
                bbox=self._build_bbox(index),
                simulated_identity_key=roster_id,
                flags=flags,
            )
            tracks.append(track)

        current_track_count = len(tracks)
        for index in range(simulation_hints.unknownFaceCount):
            track_number = current_track_count + index + 1
            tracks.append(
                DetectedFaceTrack(
                    track_id=f"track-{track_number:03d}",
                    embedding=self.face_recognition_service.build_capture_embedding(
                        track_key=f"{payload.sessionId}::unknown::{track_number}",
                        source_capture_ids=payload.captureImages,
                    ),
                    source_capture_ids=payload.captureImages,
                    quality_score=bounded_score(
                        f"classroom-quality::{payload.sessionId}::unknown::{track_number}",
                        0.68,
                        0.91,
                    ),
                    frame_hits=max(1, min(len(payload.captureImages), 3)),
                    bbox=self._build_bbox(track_number),
                    simulated_identity_key=None,
                    flags=[],
                )
            )

        return tracks

    def _resolve_visible_roster_ids(
        self,
        payload: ClassroomRecognitionRequest,
        simulation_hints: ClassroomSimulationHints,
    ) -> list[str]:
        if simulation_hints.visibleRosterIds:
            return simulation_hints.visibleRosterIds

        roster_ids = [student.personId for student in payload.classRoster]
        default_visible_count = min(len(roster_ids), max(1, len(roster_ids) - 2))
        return roster_ids[:default_visible_count]

    def _build_bbox(self, index: int) -> dict[str, int]:
        column = (index - 1) % 5
        row = (index - 1) // 5
        return {
            "x": 40 + column * 120,
            "y": 60 + row * 120,
            "width": 92,
            "height": 92,
        }
