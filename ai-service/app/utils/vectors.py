from __future__ import annotations

import math


def normalize_vector(values: list[float]) -> list[float]:
    magnitude = math.sqrt(sum(value * value for value in values))
    if magnitude == 0:
        return [0.0 for _ in values]
    return [round(value / magnitude, 8) for value in values]


def average_vectors(vectors: list[list[float]]) -> list[float]:
    if not vectors:
        return []

    if isinstance(vectors[0], float):
        return normalize_vector(vectors)

    averaged = [
        sum(vector[index] for vector in vectors) / len(vectors)
        for index in range(len(vectors[0]))
    ]
    return normalize_vector(averaged)


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0

    similarity = sum(left_value * right_value for left_value, right_value in zip(left, right))
    return round(max(-1.0, min(1.0, similarity)), 4)
