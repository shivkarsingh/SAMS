export function TeacherHeroSection({
  profile,
  overview,
  onOpenClasses,
  onOpenSchedule
}) {
  const hasClasses = overview.sectionsHandled > 0;

  return (
    <section className="dashboard-hero" id="overview">
      <article className="glass-card dashboard-intro teacher-hero-intro">
        <div className="dashboard-kicker-row">
          <span className="pill">Teacher Dashboard</span>
          <span className="dashboard-status-tag">
            {overview.averageAttendance}% average class attendance
          </span>
        </div>

        <h1>
          Good to see you, {profile.firstName}.{" "}
          {hasClasses
            ? "Your classes are moving with solid attendance momentum."
            : "Let&apos;s set up your first class properly."}
        </h1>
        <p>
          {hasClasses
            ? "Use this workspace to track sections, close pending attendance, monitor low-attendance students, and stay ahead of today's teaching flow."
            : "Create the class, generate the join link, ask students to join and complete face enrollment, then attendance sessions can run on the correct roster."}
        </p>

        <div className="dashboard-profile-strip teacher-profile-strip">
          <div>
            <span>Designation</span>
            <strong>{profile.designation}</strong>
          </div>
          <div>
            <span>Specialization</span>
            <strong>{profile.specialization}</strong>
          </div>
          <div>
            <span>Experience</span>
            <strong>{profile.experienceYears} years</strong>
          </div>
          <div>
            <span>Joining Year</span>
            <strong>{profile.joiningYear}</strong>
          </div>
        </div>

        <div className="dashboard-actions">
          <button className="primary-button large" type="button" onClick={onOpenClasses}>
            Review Managed Classes
          </button>
          <button className="secondary-button large" type="button" onClick={onOpenSchedule}>
            Open Today's Schedule
          </button>
        </div>
      </article>

      <article className="glass-card dashboard-spotlight teacher-spotlight-card">
        <div
          className="attendance-ring teacher-ring"
          style={{
            "--attendance-progress": `${overview.averageAttendance}%`
          }}
        >
          <div className="attendance-ring-core">
            <span>Section Avg</span>
            <strong>{overview.averageAttendance}%</strong>
          </div>
        </div>

        <div className="spotlight-metrics">
          <div className="spotlight-metric">
            <span>Classes Today</span>
            <strong>{overview.classesToday}</strong>
          </div>
          <div className="spotlight-metric">
            <span>No Attendance Yet</span>
            <strong>{overview.pendingAttendance}</strong>
          </div>
          <div className="spotlight-metric">
            <span>Total Students</span>
            <strong>{overview.totalStudents}</strong>
          </div>
          <div className="spotlight-metric">
            <span>Flagged Students</span>
            <strong>{overview.flaggedStudents}</strong>
          </div>
        </div>
      </article>
    </section>
  );
}
