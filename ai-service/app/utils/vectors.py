from __future__ import annotations

import hashlib
import math


VECTOR_SIZE = 32


def _hash_to_unit_values(key: str, length: int = VECTOR_SIZE) -> list[float]:
    values: list[float] = []
    seed = key.encode("utf-8")
    counter = 0

    while len(values) < length:
        digest = hashlib.sha256(seed + counter.to_bytes(2, "big")).digest()
        for index in range(0, len(digest), 4):
            chunk = digest[index : index + 4]
            number = int.from_bytes(chunk, "big") / 0xFFFFFFFF
            values.append(number)
            if len(values) == length:
                break
        counter += 1

    return values


def normalize_vector(values: list[float]) -> list[float]:
    magnitude = math.sqrt(sum(value * value for value in values))
    if magnitude == 0:
        return [0.0 for _ in values]
    return [round(value / magnitude, 8) for value in values]


def build_embedding_from_key(key: str) -> list[float]:
    centered = [(value * 2) - 1 for value in _hash_to_unit_values(key)]
    return normalize_vector(centered)


def average_vectors(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        return [0.0 for _ in range(VECTOR_SIZE)]

    averaged = [
        sum(vector[index] for vector in vectors) / len(vectors)
        for index in range(len(vectors[0]))
    ]
    return normalize_vector(averaged)


def jitter_vector(base_vector: list[float], key: str, scale: float) -> list[float]:
    noise = build_embedding_from_key(f"noise::{key}")
    jittered = [
        base_value + ((noise_value - 0.5) * scale)
        for base_value, noise_value in zip(base_vector, noise)
    ]
    return normalize_vector(jittered)


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0

    similarity = sum(left_value * right_value for left_value, right_value in zip(left, right))
    return round(max(-1.0, min(1.0, similarity)), 4)


def bounded_score(key: str, minimum: float, maximum: float) -> float:
    base_value = _hash_to_unit_values(key, length=1)[0]
    return round(minimum + (maximum - minimum) * base_value, 2)
