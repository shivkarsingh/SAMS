import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";
import { Sparkline } from "../../../components/charts/Sparkline";

export function StudentInsightsSidebar({ attendanceTrend, peerComparison }) {
  const trendLabels = attendanceTrend.map((point) => point.label).join("  ");

  return (
    <aside className="dashboard-side-grid">
      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Trend"
          title="Six-week attendance momentum."
        />

        <Sparkline points={attendanceTrend} gradientId="studentTrendGradient" />
        <div className="trend-labels">{trendLabels}</div>

        <div className="trend-stat-grid">
          {attendanceTrend.map((point) => (
            <div key={point.label} className="trend-stat-card">
              <span>{point.label}</span>
              <strong>{point.value}%</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="glass-card dashboard-panel" id="insights">
        <DashboardPanelHeader
          label="Comparison"
          title="See how you compare."
        />

        <div className="comparison-list">
          {peerComparison.map((item) => (
            <div key={item.label} className="comparison-row">
              <div className="comparison-copy">
                <span>{item.label}</span>
                <strong>{item.value}%</strong>
              </div>
              <div className="metric-bar compact">
                <div
                  className={`metric-bar-fill ${
                    item.label === "You" ? "student" : "average"
                  }`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </article>
    </aside>
  );
}

