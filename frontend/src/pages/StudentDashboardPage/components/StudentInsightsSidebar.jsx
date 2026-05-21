import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";
import { Sparkline } from "../../../components/charts/Sparkline";

function getAttendanceExtremes(classes = []) {
  const recordedClasses = classes
    .filter((course) => Number(course.total ?? 0) > 0)
    .slice()
    .sort(
      (left, right) =>
        Number(left.studentPercentage ?? 0) - Number(right.studentPercentage ?? 0)
    );

  if (!recordedClasses.length) {
    return {
      highest: null,
      lowest: null
    };
  }

  return {
    lowest: recordedClasses[0],
    highest: recordedClasses[recordedClasses.length - 1]
  };
}

function AttendanceExtremeCard({ label, course, tone }) {
  if (!course) {
    return (
      <div className={`attendance-extreme-card ${tone}`}>
        <span>{label}</span>
        <strong>Not available</strong>
        <p>Attendance records are needed first.</p>
      </div>
    );
  }

  return (
    <div className={`attendance-extreme-card ${tone}`}>
      <span>{label}</span>
      <strong>{course.studentPercentage}%</strong>
      <p>
        {course.code} - {course.title}
      </p>
      <small>
        {course.attended}/{course.total} units • {course.statusLabel}
      </small>
    </div>
  );
}

export function StudentInsightsSidebar({
  attendanceTrend,
  peerComparison,
  classes = []
}) {
  const trendLabels = attendanceTrend.map((point) => point.label).join("  ");
  const { highest, lowest } = getAttendanceExtremes(classes);

  return (
    <aside className="dashboard-side-grid">
      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Subject Comparison"
          title="Best subject and low subject."
        />

        <div className="attendance-extreme-grid">
          <AttendanceExtremeCard label="Best Subject" course={highest} tone="positive" />
          <AttendanceExtremeCard label="Low Subject" course={lowest} tone="warning" />
        </div>
      </article>

      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Trend"
          title="Six-week attendance momentum."
        />

        <Sparkline points={attendanceTrend} gradientId="studentTrendGradient" />
        <div className="trend-labels">{trendLabels}</div>

        <div className="trend-stat-grid">
          {attendanceTrend.map((point) => (
            <div key={point.label} className="trend-stat-card">
              <span>{point.label}</span>
              <strong>{point.value}%</strong>
              <small>{point.sessions ?? 0} sessions</small>
            </div>
          ))}
        </div>
      </article>

      <article className="glass-card dashboard-panel" id="insights">
        <DashboardPanelHeader
          label="Comparison"
          title="Your attendance against class averages."
        />

        <div className="comparison-list">
          {peerComparison.map((item) => (
            <div key={item.label} className="comparison-row">
              <div className="comparison-copy">
                <div className="comparison-copy-main">
                  <span>{item.label}</span>
                  {item.detail ? <small>{item.detail}</small> : null}
                </div>
                <strong>{item.value}%</strong>
              </div>
              <div className="metric-bar compact">
                <div
                  className={`metric-bar-fill ${
                    item.label === "You" ? "student" : "average"
                  }`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </article>
    </aside>
  );
}
