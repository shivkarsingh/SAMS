import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";

export function TeacherActionSection({
  studentWatchlist,
  quickInsights,
  recentActivity,
  priorities
}) {
  return (
    <section className="dashboard-lower-grid">
      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Student Watchlist"
          title="Students who need quick follow-up."
        />

        <div className="teacher-watchlist">
          {studentWatchlist.length ? (
            studentWatchlist.map((student) => (
              <article key={`${student.name}-${student.section}`} className="watchlist-card">
                <div className="watchlist-header">
                  <div>
                    <h3>{student.name}</h3>
                    <span>{student.section}</span>
                  </div>
                  <strong>{student.attendance}%</strong>
                </div>
                <p>{student.note}</p>
              </article>
            ))
          ) : (
            <p className="panel-fallback">
              Watchlist insights will appear after classes and student rosters are active.
            </p>
          )}
        </div>
      </article>

      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Quick Actions"
          title="Insights, priorities, and recent work."
        />

        <div className="teacher-actions-grid">
          <div className="alert-list">
            {quickInsights.map((alert) => (
              <article
                key={alert.title}
                className={`alert-card ${
                  alert.tone === "warning" ? "warning" : "positive"
                }`}
              >
                <h3>{alert.title}</h3>
                <p>{alert.message}</p>
              </article>
            ))}
          </div>

          <div className="goals-achievements-grid teacher-focus-grid">
            <div>
              <h3>Priorities</h3>
              <div className="simple-list">
                {priorities.map((goal) => (
                  <div key={goal.title} className="simple-list-item">
                    <strong>{goal.title}</strong>
                    <span>{goal.target}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3>Recent Activity</h3>
              <div className="achievement-list">
                {recentActivity.map((activity) => (
                  <span key={activity} className="achievement-pill">
                    {activity}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}
