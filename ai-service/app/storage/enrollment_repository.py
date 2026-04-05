from __future__ import annotations

from dataclasses import asdict

from app.models.domain import EnrolledProfile
from app.storage.json_file_store import JsonFileStore


class EnrollmentRepository:
    def __init__(self, store: JsonFileStore) -> None:
        self.store = store

    def upsert_profile(self, profile: EnrolledProfile) -> dict:
        payload = self.store.read()
        profiles: list[dict] = payload["profiles"]
        serialized_profile = self._serialize_profile(profile)

        for index, existing_profile in enumerate(profiles):
            if existing_profile["person_id"] == profile.person_id:
                profiles[index] = serialized_profile
                break
        else:
            profiles.append(serialized_profile)

        self.store.write(payload)
        return serialized_profile

    def get_profile(self, person_id: str) -> EnrolledProfile | None:
        payload = self.store.read()
        for profile in payload["profiles"]:
            if profile["person_id"] == person_id:
                return self._deserialize_profile(profile)
        return None

    def list_profiles(self, person_ids: list[str] | None = None) -> list[EnrolledProfile]:
        payload = self.store.read()
        profiles = [self._deserialize_profile(profile) for profile in payload["profiles"]]
        if person_ids is None:
            return profiles

        person_id_set = set(person_ids)
        return [profile for profile in profiles if profile.person_id in person_id_set]

    def _serialize_profile(self, profile: EnrolledProfile) -> dict:
        return asdict(profile)

    def _deserialize_profile(self, payload: dict) -> EnrolledProfile:
        return EnrolledProfile(
            person_id=payload["person_id"],
            full_name=payload["full_name"],
            role=payload["role"],
            embedding=payload["embedding"],
            reference_embeddings=payload["reference_embeddings"],
            class_ids=payload.get("class_ids", []),
            average_quality_score=payload.get("average_quality_score", 0.0),
            metadata=payload.get("metadata", {}),
            enrolled_at=payload.get("enrolled_at", ""),
            updated_at=payload.get("updated_at", ""),
        )
