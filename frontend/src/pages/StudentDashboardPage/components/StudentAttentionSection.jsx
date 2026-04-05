import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";

export function StudentAttentionSection({ alerts, goals, achievements }) {
  return (
    <section className="dashboard-lower-grid">
      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Alerts"
          title="What deserves your attention next."
        />

        <div className="alert-list">
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
      </article>

      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Goals & Wins"
          title="Momentum builders for the week."
        />

        <div className="goals-achievements-grid">
          <div>
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

