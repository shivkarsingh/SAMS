export function StudentHeroSection({
  profile,
  overview,
  faceProfile
}) {
  const hasJoinedClasses = profile.joinedClassesCount > 0;
  const safeRangeProgress = overview.joinedClasses
    ? Math.round((overview.safeClasses / overview.joinedClasses) * 100)
    : 0;

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
            ? "Your joined classes, safe-range status, schedule, and exam dates are ready on this dashboard."
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
            <span>Batch / Sem</span>
            <strong>
              {[profile.batch || profile.yearOfPassing, profile.semesterLabel]
                .filter(Boolean)
                .join(" / ") || "TBD"}
            </strong>
          </div>
          <div>
            <span>Face Profile</span>
            <strong>
              {faceProfile.status === "enrolled" ? "Ready" : "Pending setup"}
            </strong>
          </div>
        </div>
      </article>

      <article className="glass-card dashboard-spotlight">
        <div
          className="attendance-ring"
          style={{
            "--attendance-progress": `${safeRangeProgress}%`
          }}
        >
          <div className="attendance-ring-core">
            <span>Safe Range</span>
            <strong>
              {overview.safeClasses}/{overview.joinedClasses || 0}
            </strong>
          </div>
        </div>

        <div className="spotlight-metrics">
          <div className="spotlight-metric">
            <span>Joined Classes</span>
            <strong>{overview.joinedClasses}</strong>
          </div>
          <div className="spotlight-metric">
            <span>Safe Range</span>
            <strong>{overview.safeClasses}</strong>
          </div>
          <div className="spotlight-metric">
            <span>Below Range</span>
            <strong>{overview.belowRangeClasses}</strong>
          </div>
          <div className="spotlight-metric">
            <span>Exam Dates</span>
            <strong>{overview.upcomingExams ?? 0}</strong>
          </div>
        </div>
      </article>
    </section>
  );
}
