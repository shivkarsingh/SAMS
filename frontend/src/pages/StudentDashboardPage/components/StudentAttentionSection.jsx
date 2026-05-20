import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";

export function StudentAttentionSection({
  alerts,
  goals,
  achievements,
  aiCoach,
  recoveryPlan
}) {
  return (
    <section className="dashboard-lower-grid" id="insights">
      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="AI Attendance Coach"
          title="The next best move from your real attendance data."
        />

        <article
          className={`student-ai-coach-card ${
            aiCoach?.tone === "warning" ? "warning" : "positive"
          }`}
        >
          <h3>{aiCoach?.title ?? "Attendance coach is waiting for data"}</h3>
          <p>{aiCoach?.message ?? "Join classes and record attendance to unlock guidance."}</p>
          <strong>{aiCoach?.nextBestAction ?? "Start by joining a classroom."}</strong>
        </article>

        <div className="student-recovery-list">
          {(recoveryPlan ?? []).length ? (
            recoveryPlan.map((item) => (
              <div key={item.id} className={`student-recovery-item ${item.statusTone}`}>
                <div>
                  <span>{item.code}</span>
                  <strong>{item.title}</strong>
                </div>
                <p>{item.action}</p>
                <b>{item.percentage}%</b>
              </div>
            ))
          ) : (
            <p className="panel-fallback">
              Your recovery plan will appear once you join classes.
            </p>
          )}
        </div>
      </article>

      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Goals, Alerts & Wins"
          title="Small actions that keep your dashboard healthy."
        />

        <div className="goals-achievements-grid">
          <div>
            <h3>Alerts</h3>
            <div className="alert-list compact">
              {alerts.map((alert) => (
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

            <h3>Current Goals</h3>
            <div className="simple-list">
              {goals.map((goal) => (
                <div key={goal.title} className="simple-list-item">
                  <strong>{goal.title}</strong>
                  <span>{goal.target}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3>Achievements</h3>
            <div className="achievement-list">
              {achievements.map((achievement) => (
                <span key={achievement} className="achievement-pill">
                  {achievement}
                </span>
              ))}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}
