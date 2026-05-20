export function StudentSummaryGrid({ dashboard, performanceLeader }) {
  return (
    <section className="dashboard-summary-grid">
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Classes Joined</span>
        <strong>{dashboard.overview.joinedClasses}</strong>
        <p>
          {dashboard.overview.recordedClasses} class
          {dashboard.overview.recordedClasses === 1 ? "" : "es"} have attendance records.
        </p>
      </article>
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Overall Attendance</span>
        <strong>{dashboard.overview.overallAttendance}%</strong>
        <p>
          {dashboard.overview.safeClasses} safe, {dashboard.overview.belowRangeClasses} below range.
        </p>
      </article>
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Present / Total</span>
        <strong>
          {dashboard.overview.attendedSessions}/{dashboard.overview.totalRecordedSessions}
        </strong>
        <p>{dashboard.overview.missedSessions} absent overall, {dashboard.overview.missedClassesThisMonth} this month.</p>
      </article>
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Upcoming Exams</span>
        <strong>{dashboard.overview.upcomingExams ?? 0}</strong>
        <p>
          {dashboard.overview.upcomingExams
            ? `${dashboard.overview.atRiskExams ?? 0} need attention. Next: ${dashboard.overview.nextExamDate}.`
            : `Priority: ${dashboard.overview.priorityClassCode || performanceLeader?.code || "TBD"}.`}
        </p>
      </article>
    </section>
  );
}
