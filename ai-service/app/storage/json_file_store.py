from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Any


class JsonFileStore:
    def __init__(self, path: Path, default_value: Any) -> None:
        self.path = path
        self.default_value = default_value
        self._lock = Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def read(self) -> Any:
        with self._lock:
            if not self.path.exists():
                self._write_unlocked(self.default_value)
                return self._clone_default()

            with self.path.open("r", encoding="utf-8") as file:
                return json.load(file)

    def write(self, payload: Any) -> None:
        with self._lock:
            self._write_unlocked(payload)

    def _write_unlocked(self, payload: Any) -> None:
        with self.path.open("w", encoding="utf-8") as file:
            json.dump(payload, file, indent=2)

    def _clone_default(self) -> Any:
        return json.loads(json.dumps(self.default_value))
