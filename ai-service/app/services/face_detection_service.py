from __future__ import annotations

from app.core.config import settings
from app.models.domain import DetectedFace, DetectedFaceTrack, EnrolledProfile
from app.schemas.attendance import ClassroomRecognitionRequest, ClassroomSimulationHints
from app.utils.vectors import average_vectors, bounded_score, cosine_similarity


class FaceDetectionService:
    def __init__(self, face_recognition_service, anti_spoof_service) -> None:
        self.face_recognition_service = face_recognition_service
        self.anti_spoof_service = anti_spoof_service

    def detect_and_track_faces(
        self,
        payload: ClassroomRecognitionRequest,
        roster_profiles_by_id: dict[str, EnrolledProfile],
    ) -> list[DetectedFaceTrack]:
        required_track_frames = self._required_track_frames(payload)

        if settings.execution_mode == "simulated":
            return self._detect_and_track_faces_simulated(
                payload=payload,
                roster_profiles_by_id=roster_profiles_by_id,
                required_track_frames=required_track_frames,
            )

        detections = self.face_recognition_service.detect_faces(
            capture_images=payload.captureImages,
            max_faces=max(payload.maxFaces * len(payload.captureImages), payload.maxFaces),
        )

        tracks: list[DetectedFaceTrack] = []
        source_track_ids: dict[str, set[str]] = {}

        for detection in detections:
            source_track_ids.setdefault(detection.source_capture_id, set())
            matched_track = self._find_matching_track(
                detection=detection,
                tracks=tracks,
                used_track_ids=source_track_ids[detection.source_capture_id],
            )
            passive_spoof_score = self.anti_spoof_service.score_detected_face(detection)

            if matched_track is None:
                track = DetectedFaceTrack(
                    track_id=f"track-{len(tracks) + 1:03d}",
                    embedding=detection.embedding,
                    source_capture_ids=[detection.source_capture_id],
                    quality_score=detection.quality_score,
                    frame_hits=1,
                    bbox=detection.bbox,
                    passive_spoof_score=passive_spoof_score,
                    flags=[],
                )
                tracks.append(track)
                source_track_ids[detection.source_capture_id].add(track.track_id)
                continue

            matched_track.embedding = average_vectors(
                [matched_track.embedding, detection.embedding]
            )
            matched_track.quality_score = round(
                (matched_track.quality_score + detection.quality_score) / 2,
                2,
            )
            matched_track.passive_spoof_score = round(
                min(matched_track.passive_spoof_score, passive_spoof_score),
                2,
            )
            if detection.source_capture_id not in matched_track.source_capture_ids:
                matched_track.source_capture_ids.append(detection.source_capture_id)
                matched_track.frame_hits += 1
            if detection.quality_score >= matched_track.quality_score:
                matched_track.bbox = detection.bbox

            source_track_ids[detection.source_capture_id].add(matched_track.track_id)

        for track in tracks:
            if track.quality_score < settings.low_quality_face_threshold:
                track.flags.append("blurred-face")
            if track.passive_spoof_score < settings.passive_spoof_threshold:
                track.flags.append("spoof-risk")
            if track.frame_hits < required_track_frames:
                track.flags.append("low-frame-hits")

        tracks.sort(
            key=lambda track: (
                track.frame_hits,
                track.quality_score,
                track.passive_spoof_score,
            ),
            reverse=True,
        )
        return tracks[: payload.maxFaces]

    def _find_matching_track(
        self,
        detection: DetectedFace,
        tracks: list[DetectedFaceTrack],
        used_track_ids: set[str],
    ) -> DetectedFaceTrack | None:
        best_track: DetectedFaceTrack | None = None
        best_similarity = -1.0

        for track in tracks:
            if track.track_id in used_track_ids:
                continue

            similarity = cosine_similarity(detection.embedding, track.embedding)
            if similarity > best_similarity:
                best_similarity = similarity
                best_track = track

        if (
            best_track is not None
            and best_similarity >= settings.tracking_similarity_threshold
        ):
            return best_track

        return None

    def _detect_and_track_faces_simulated(
        self,
        payload: ClassroomRecognitionRequest,
        roster_profiles_by_id: dict[str, EnrolledProfile],
        required_track_frames: int,
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
                required_track_frames,
                min(len(payload.captureImages), 4),
            )

            flags: list[str] = []
            if blurred:
                flags.append("blurred-face")
            if spoofed:
                flags.append("spoof-risk")
            if low_confidence:
                flags.append("low-frame-hits")

            track = DetectedFaceTrack(
                track_id=f"track-{index:03d}",
                embedding=self.face_recognition_service.build_capture_embedding(
                    track_key=f"{payload.sessionId}::{roster_id}",
                    source_capture_ids=payload.captureImages,
                    enrolled_profile=profile,
                    low_confidence=low_confidence,
                ).embedding,
                source_capture_ids=payload.captureImages,
                quality_score=quality_score,
                frame_hits=frame_hits,
                bbox=self._build_bbox(index),
                passive_spoof_score=0.43 if spoofed else 0.88,
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
                    ).embedding,
                    source_capture_ids=payload.captureImages,
                    quality_score=bounded_score(
                        f"classroom-quality::{payload.sessionId}::unknown::{track_number}",
                        0.68,
                        0.91,
                    ),
                    frame_hits=max(1, min(len(payload.captureImages), required_track_frames)),
                    bbox=self._build_bbox(track_number),
                    passive_spoof_score=0.84,
                    simulated_identity_key=None,
                    flags=[],
                )
            )

        return tracks

    def _required_track_frames(self, payload: ClassroomRecognitionRequest) -> int:
        # A single classroom photo should still be able to auto-mark attendance.
        return max(1, min(payload.minimumTrackFrames, len(payload.captureImages)))

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
