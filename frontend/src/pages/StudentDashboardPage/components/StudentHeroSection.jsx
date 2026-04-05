export function StudentHeroSection({
  profile,
  overview,
  faceProfile,
  onReviewPerformance,
  onOpenSchedule,
  onOpenClassrooms,
  onOpenFaceEnrollment
}) {
  const hasJoinedClasses = profile.joinedClassesCount > 0;

  return (
    <section className="dashboard-hero" id="overview">
      <article className="glass-card dashboard-intro">
        <div className="dashboard-kicker-row">
          <span className="pill">Student Dashboard</span>
          <span className="dashboard-status-tag">
            {overview.overallAttendance}% overall attendance
          </span>
        </div>

        <h1>
          Welcome back, {profile.firstName}.{" "}
          {hasJoinedClasses
            ? "Your attendance story is taking shape."
            : "Let&apos;s get your classroom setup ready."}
        </h1>
        <p>
          {hasJoinedClasses
            ? "Keep your best classes ahead, protect weaker subjects early, and use this workspace to stay on top of schedule, ranking, and attendance momentum."
            : "Join your classes, then open the dedicated face enrollment page to capture or upload your setup images before attendance begins."}
        </p>

        <div className="dashboard-profile-strip">
          <div>
            <span>ID</span>
            <strong>{profile.userId}</strong>
          </div>
          <div>
            <span>Department</span>
            <strong>{profile.department}</strong>
          </div>
          <div>
            <span>Batch</span>
            <strong>{profile.batch}</strong>
          </div>
          <div>
            <span>Face Profile</span>
            <strong>
              {faceProfile.status === "enrolled" ? "Ready" : "Pending setup"}
            </strong>
          </div>
        </div>

        <div className="dashboard-actions">
          <button className="primary-button large" type="button" onClick={onOpenFaceEnrollment}>
            Open Face Enrollment
          </button>
          <button className="secondary-button large" type="button" onClick={onOpenClassrooms}>
            Join a Classroom
          </button>
          <button className="primary-button large" type="button" onClick={onReviewPerformance}>
            Review Class Performance
          </button>
          <button className="secondary-button large" type="button" onClick={onOpenSchedule}>
            See Today's Schedule
          </button>
        </div>
      </article>

      <article className="glass-card dashboard-spotlight">
        <div
          className="attendance-ring"
          style={{
            "--attendance-progress": `${overview.overallAttendance}%`
          }}
        >
          <div className="attendance-ring-core">
            <span>Overall</span>
            <strong>{overview.overallAttendance}%</strong>
          </div>
        </div>

        <div className="spotlight-metrics">
          <div className="spotlight-metric">
            <span>Class Rank</span>
            <strong>
              {overview.classRank
                ? `#${overview.classRank}/${overview.totalStudentsInCohort}`
                : "TBD"}
            </strong>
          </div>
          <div className="spotlight-metric">
            <span>Consistency Score</span>
            <strong>{overview.consistencyScore}/100</strong>
          </div>
          <div className="spotlight-metric">
            <span>Current Streak</span>
            <strong>{overview.attendanceStreak} days</strong>
          </div>
          <div className="spotlight-metric">
            <span>Missed This Month</span>
            <strong>{overview.missedClassesThisMonth}</strong>
          </div>
        </div>
      </article>
    </section>
  );
}
