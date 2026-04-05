from app.core.config import settings
from app.schemas.legacy import AttendanceRiskRequest, AttendanceRiskResponse


def run_attendance_risk(payload: AttendanceRiskRequest) -> AttendanceRiskResponse:
    raw_score = min(
        0.98,
        max(
            0.05,
            (100 - payload.attendancePercentage) / 100 + payload.recentAbsences * 0.04,
        ),
    )

    risk_level = "high" if raw_score >= 0.7 else "medium" if raw_score >= 0.4 else "low"

    return AttendanceRiskResponse(
        riskLevel=risk_level,
        score=round(raw_score, 2),
        model=settings.attendance_risk_model,
        notes=(
            "Rule-based placeholder. Good upgrade path is XGBoost for tabular risk "
            "features and sequence models when longitudinal attendance data matures."
        ),
    )
