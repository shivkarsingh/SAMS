from __future__ import annotations

from app.schemas.attendance import LivenessSimulationHints, LivenessVerificationRequest
from app.utils.vectors import bounded_score


class AntiSpoofService:
    def evaluate(self, payload: LivenessVerificationRequest) -> float:
        simulation_hints = payload.simulationHints or LivenessSimulationHints()

        if simulation_hints.passiveSpoofScore is not None:
            return round(simulation_hints.passiveSpoofScore, 2)

        joined = " ".join(payload.captureImages).lower()
        if "screen" in joined or "printed" in joined or "spoof" in joined:
            return 0.41

        return bounded_score(
            f"spoof::{payload.personId}::{'::'.join(payload.captureImages)}",
            0.81,
            0.96,
        )
