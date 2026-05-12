from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse

from app.core.config import BASE_DIR, settings
from app.core.errors import ImageInputError, ModelUnavailableError


def describe_image_source(source: str, index: int | None = None) -> str:
    if source.startswith("data:image/"):
        return f"image-{index + 1}" if index is not None else "inline-image"

    parsed = urlparse(source)
    if parsed.scheme in {"http", "https"}:
        return parsed.path.rsplit("/", 1)[-1] or parsed.netloc

    return Path(source).name or (f"image-{index + 1}" if index is not None else "image")


def load_image(source: str):
    image_bytes = _read_image_bytes(source)
    try:
        import numpy as np
        from PIL import Image, ImageOps
    except ImportError as exc:
        raise ModelUnavailableError(
            "Install Pillow and numpy to enable real image inference."
        ) from exc

    try:
        with Image.open(BytesIO(image_bytes)) as image:
            normalized = ImageOps.exif_transpose(image).convert("RGB")
            return np.asarray(normalized)
    except Exception as exc:
        raise ImageInputError("A supplied image could not be decoded.") from exc


def crop_image(image, bbox: dict[str, int], margin_ratio: float):
    height, width = image.shape[:2]
    margin_x = int(bbox["width"] * margin_ratio)
    margin_y = int(bbox["height"] * margin_ratio)

    x1 = max(0, bbox["x"] - margin_x)
    y1 = max(0, bbox["y"] - margin_y)
    x2 = min(width, bbox["x"] + bbox["width"] + margin_x)
    y2 = min(height, bbox["y"] + bbox["height"] + margin_y)

    return image[y1:y2, x1:x2].copy()


def _read_image_bytes(source: str) -> bytes:
    if source.startswith("data:image/"):
        return _validate_image_size(_decode_data_url(source))

    parsed = urlparse(source)
    if parsed.scheme in {"http", "https"}:
        return _download_image(source)

    path = Path(source)
    if not path.is_absolute():
        if path.exists():
            return _validate_image_size(path.read_bytes())
        path = (BASE_DIR / source).resolve()

    if not path.exists():
        raise ImageInputError(f"Image file not found: {source}")

    return _validate_image_size(path.read_bytes())


def _decode_data_url(source: str) -> bytes:
    if "," not in source:
        raise ImageInputError("Invalid data URL supplied for an image.")

    _, encoded = source.split(",", 1)
    try:
        return base64.b64decode(encoded, validate=True)
    except Exception as exc:
        raise ImageInputError("Image data URL is not valid base64.") from exc


def _download_image(source: str) -> bytes:
    try:
        import requests
    except ImportError as exc:
        raise ModelUnavailableError(
            "Install requests to enable HTTP image inputs."
        ) from exc

    try:
        response = requests.get(
            source,
            timeout=settings.image_download_timeout_seconds,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise ImageInputError(f"Unable to download image: {source}") from exc

    content = response.content
    if len(content) > settings.max_image_bytes:
        raise ImageInputError(
            "Downloaded image is larger than the configured maximum size."
        )

    return content


def _validate_image_size(image_bytes: bytes) -> bytes:
    if len(image_bytes) > settings.max_image_bytes:
        raise ImageInputError(
            "Supplied image is larger than the configured maximum size."
        )

    return image_bytes
