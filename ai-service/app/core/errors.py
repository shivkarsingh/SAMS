from __future__ import annotations


class AIServiceError(Exception):
    def __init__(self, detail: str, status_code: int = 500) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


class ImageInputError(AIServiceError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail=detail, status_code=400)


class ModelUnavailableError(AIServiceError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail=detail, status_code=503)
