import { AppBrand } from "../../../components/common/AppBrand";

export function TeacherDashboardHeader({ onLogout, onNavigate }) {
  return (
    <header className="dashboard-topbar glass-card">
      <AppBrand href="#/" subtitle="Teacher Workspace" />

      <nav className="dashboard-nav">
        <button
          className="dashboard-nav-button"
          type="button"
          onClick={() => onNavigate("overview")}
        >
          Overview
        </button>
        <button
          className="dashboard-nav-button"
          type="button"
          onClick={() => onNavigate("class-management")}
        >
          Create Class
        </button>
        <button
          className="dashboard-nav-button"
          type="button"
          onClick={() => onNavigate("classes")}
        >
          Classes
        </button>
        <button
          className="dashboard-nav-button"
          type="button"
          onClick={() => onNavigate("schedule")}
        >
          Schedule
        </button>
        <button
          className="dashboard-nav-button"
          type="button"
          onClick={() => onNavigate("insights")}
        >
          Insights
        </button>
      </nav>

      <div className="dashboard-header-actions">
        <a className="ghost-button" href="#/">
          Home
        </a>
        <button className="primary-button" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
