export function LoadingCard({ label, title, message, action }) {
  return (
    <div className="glass-card loading-card">
      <span className="pill">{label}</span>
      <h1>{title}</h1>
      {message ? <p className="loading-copy">{message}</p> : null}
      {action ? <div className="dashboard-actions">{action}</div> : null}
    </div>
  );
}

