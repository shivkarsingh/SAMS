export function StudentSummaryGrid({ dashboard, performanceLeader }) {
  return (
    <section className="dashboard-summary-grid">
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Best Performing Class</span>
        {performanceLeader ? (
          <>
            <strong>{performanceLeader.title}</strong>
            <p>
              {performanceLeader.studentPercentage}% attendance with room to keep
              leading the cohort.
            </p>
          </>
        ) : (
          <>
            <strong>No classes joined yet</strong>
            <p>Use the classroom hub to join your first class and unlock tracking.</p>
          </>
        )}
      </article>
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Upcoming Load</span>
        <strong>{dashboard.upcomingClasses.length} classes today</strong>
        <p>Next class starts at {dashboard.upcomingClasses[0]?.time ?? "TBD"}.</p>
      </article>
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Focus Goal</span>
        <strong>{dashboard.goals[0]?.title ?? "Set up your workspace"}</strong>
        <p>{dashboard.goals[0]?.target ?? "Join classes and complete face enrollment."}</p>
      </article>
      <article className="glass-card summary-card">
        <span className="metric-eyebrow">Achievements</span>
        <strong>{dashboard.achievements.length} milestones</strong>
        <p>{dashboard.achievements[0] ?? "Your first milestone will appear here."}</p>
      </article>
    </section>
  );
}
