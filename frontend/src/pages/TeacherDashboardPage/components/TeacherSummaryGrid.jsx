export function TeacherSummaryGrid({ overview, priorities }) {
  return (
    <section className="dashboard-summary-grid">
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Sections Handled</span>
        <strong>{overview.sectionsHandled}</strong>
        <p>Multiple sections and labs tracked from one place.</p>
      </article>
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">No Attendance Yet</span>
        <strong>{overview.pendingAttendance}</strong>
        <p>Start these classes once so teacher and student reporting stays synced.</p>
      </article>
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Flagged Students</span>
        <strong>{overview.flaggedStudents}</strong>
        <p>Students on the watchlist need follow-up soon.</p>
      </article>
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Top Priority</span>
        <strong>{priorities[0]?.title}</strong>
        <p>{priorities[0]?.target}</p>
      </article>
    </section>
  );
}
