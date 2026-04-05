from __future__ import annotations

from app.storage.json_file_store import JsonFileStore


class SessionRepository:
    def __init__(self, store: JsonFileStore) -> None:
        self.store = store

    def save_session(self, session_record: dict) -> dict:
        payload = self.store.read()
        sessions: list[dict] = payload["sessions"]

        for index, existing_session in enumerate(sessions):
            if existing_session["sessionId"] == session_record["sessionId"]:
                sessions[index] = session_record
                break
        else:
            sessions.append(session_record)

        self.store.write(payload)
        return session_record

    def get_session(self, session_id: str) -> dict | None:
        payload = self.store.read()
        for session in payload["sessions"]:
            if session["sessionId"] == session_id:
                return session
        return None
