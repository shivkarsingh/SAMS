from __future__ import annotations

from app.schemas.attendance import LivenessSimulationHints, LivenessVerificationRequest


class LivenessService:
    def evaluate(
        self, payload: LivenessVerificationRequest
    ) -> tuple[bool, bool, float]:
        simulation_hints = payload.simulationHints or LivenessSimulationHints()

        blink_detected = (
            simulation_hints.blinkDetected
            if simulation_hints.blinkDetected is not None
            else self._infer_blink(payload.captureImages)
        )
        head_turn_detected = (
            simulation_hints.headTurnDetected
            if simulation_hints.headTurnDetected is not None
            else self._infer_head_turn(payload.captureImages)
        )

        if simulation_hints.activeLivenessScore is not None:
            active_liveness_score = round(simulation_hints.activeLivenessScore, 2)
        else:
            success_ratio = (
                int(blink_detected) + int(head_turn_detected)
            ) / 2
            active_liveness_score = round(0.58 + (success_ratio * 0.35), 2)

        return blink_detected, head_turn_detected, active_liveness_score

    def _infer_blink(self, capture_images: list[str]) -> bool:
        joined = " ".join(capture_images).lower()
        if "no-blink" in joined:
            return False
        if "blink" in joined:
            return True
        return len(capture_images) >= 2

    def _infer_head_turn(self, capture_images: list[str]) -> bool:
        joined = " ".join(capture_images).lower()
        if "no-turn" in joined:
            return False
        if "turn-left" in joined or "turn-right" in joined or "head-turn" in joined:
            return True
        return len(capture_images) >= 3
