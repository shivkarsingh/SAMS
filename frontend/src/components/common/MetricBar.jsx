export function MetricBar({ label, value, tone = "student" }) {
  return (
    <div className="metric-bar-row">
      <span>{label}</span>
      <div className="metric-bar">
        <div
          className={`metric-bar-fill ${tone}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <strong>{value}%</strong>
    </div>
  );
}

