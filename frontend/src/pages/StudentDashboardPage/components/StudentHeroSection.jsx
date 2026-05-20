export function StudentHeroSection({
  profile,
  overview,
  faceProfile,
  onReviewPerformance,
  onOpenSchedule,
  onOpenClassrooms,
  onOpenFaceEnrollment,
  onOpenNotifications
}) {
  const hasJoinedClasses = profile.joinedClassesCount > 0;
  const recordedLabel = overview.totalRecordedSessions
    ? `${overview.attendedSessions}/${overview.totalRecordedSessions} sessions attended`
    : "No attendance recorded yet";

  return (
    <section className="dashboard-hero" id="overview">
      <article className="glass-card dashboard-intro">
        <div className="dashboard-kicker-row">
          <span className="pill">Student Dashboard</span>
          <span className="dashboard-status-tag">
            {overview.joinedClasses} class{overview.joinedClasses === 1 ? "" : "es"} joined
          </span>
        </div>

        <h1>
          Welcome back, {profile.firstName}.{" "}
          {hasJoinedClasses
            ? "Your class plan is ready."
            : "Let's get your classroom setup ready."}
        </h1>
        <p>
          {hasJoinedClasses
            ? `${recordedLabel}. Check weak subjects first, open each class for history, and use the safe-range projections before the next session.`
            : "Join your classes, then open the dedicated face enrollment page to capture or upload your setup images before attendance begins."}
        </p>

        <div className="dashboard-profile-strip">
          <div>
            <span>ID</span>
            <strong>{profile.rollNumber || profile.userId}</strong>
          </div>
          <div>
            <span>Department</span>
            <strong>{profile.department || "TBD"}</strong>
          </div>
          <div>
            <span>Batch</span>
            <strong>{profile.batch || profile.yearOfPassing || "TBD"}</strong>
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
          <button className="secondary-button large" type="button" onClick={onOpenNotifications}>
            Open Notifications
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
            <span>Joined Classes</span>
            <strong>{overview.joinedClasses}</strong>
          </div>
          <div className="spotlight-metric">
            <span>Present</span>
            <strong>{overview.attendedSessions}</strong>
          </div>
          <div className="spotlight-metric">
            <span>Absent</span>
            <strong>{overview.missedSessions}</strong>
          </div>
          <div className="spotlight-metric">
            <span>Below Range</span>
            <strong>{overview.belowRangeClasses}</strong>
          </div>
        </div>
      </article>
    </section>
  );
}
