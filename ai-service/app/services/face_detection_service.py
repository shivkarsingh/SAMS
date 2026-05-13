from __future__ import annotations

from app.core.config import settings
from app.models.domain import DetectedFace, DetectedFaceTrack, EnrolledProfile
from app.schemas.attendance import ClassroomRecognitionRequest
from app.utils.vectors import average_vectors, cosine_similarity


class FaceDetectionService:
    def __init__(self, face_recognition_service) -> None:
        self.face_recognition_service = face_recognition_service

    def detect_and_track_faces(
        self,
        payload: ClassroomRecognitionRequest,
        _roster_profiles_by_id: dict[str, EnrolledProfile],
    ) -> list[DetectedFaceTrack]:
        required_track_frames = self._required_track_frames(payload)

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
            if matched_track is None:
                track = DetectedFaceTrack(
                    track_id=f"track-{len(tracks) + 1:03d}",
                    embedding=detection.embedding,
                    source_capture_ids=[detection.source_capture_id],
                    quality_score=detection.quality_score,
                    frame_hits=1,
                    bbox=detection.bbox,
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
            if detection.source_capture_id not in matched_track.source_capture_ids:
                matched_track.source_capture_ids.append(detection.source_capture_id)
                matched_track.frame_hits += 1
            if detection.quality_score >= matched_track.quality_score:
                matched_track.bbox = detection.bbox

            source_track_ids[detection.source_capture_id].add(matched_track.track_id)

        for track in tracks:
            if track.quality_score < settings.low_quality_face_threshold:
                track.flags.append("blurred-face")
            if track.frame_hits < required_track_frames:
                track.flags.append("low-frame-hits")

        tracks.sort(
            key=lambda track: (
                track.frame_hits,
                track.quality_score,
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

    def _required_track_frames(self, payload: ClassroomRecognitionRequest) -> int:
        # A single classroom photo should still be able to auto-mark attendance.
        return max(1, min(payload.minimumTrackFrames, len(payload.captureImages)))
