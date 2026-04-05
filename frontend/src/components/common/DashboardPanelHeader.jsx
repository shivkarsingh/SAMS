export function DashboardPanelHeader({ label, title, description }) {
  return (
    <div className="dashboard-panel-header">
      <div>
        <span className="pill">{label}</span>
        <h2>{title}</h2>
        {description ? <p className="dashboard-panel-copy">{description}</p> : null}
      </div>
    </div>
  );
}

