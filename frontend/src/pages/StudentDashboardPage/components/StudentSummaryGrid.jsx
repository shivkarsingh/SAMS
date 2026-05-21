export function StudentSummaryGrid({ dashboard }) {
  return (
    <section className="dashboard-summary-grid">
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Classes Joined</span>
        <strong>{dashboard.overview.joinedClasses}</strong>
        <p>
          {dashboard.overview.noRecordClasses
            ? `${dashboard.overview.noRecordClasses} waiting for first attendance.`
            : "All joined classes are active on your dashboard."}
        </p>
      </article>
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Below Range</span>
        <strong>{dashboard.overview.belowRangeClasses}</strong>
        <p>
          {dashboard.overview.belowRangeClasses
            ? "Review class performance from tools."
            : "No recorded class is below range."}
        </p>
      </article>
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Safe Range</span>
        <strong>{dashboard.overview.safeClasses}</strong>
        <p>
          {dashboard.overview.recordedClasses
            ? `${dashboard.overview.recordedClasses} recorded class${dashboard.overview.recordedClasses === 1 ? "" : "es"} checked.`
            : "Safe-range count appears after attendance starts."}
        </p>
      </article>
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Upcoming Exam Dates</span>
        <strong>{dashboard.overview.upcomingExams ?? 0}</strong>
        <p>
          {dashboard.overview.upcomingExams
            ? `Next: ${dashboard.overview.nextExamDate}.`
            : "No exam date has been added yet."}
        </p>
      </article>
    </section>
  );
}
