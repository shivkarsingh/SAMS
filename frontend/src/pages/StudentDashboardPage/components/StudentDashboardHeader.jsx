import { AppBrand } from "../../../components/common/AppBrand";

export function StudentDashboardHeader({
  onLogout,
  onNavigate,
  onOpenFaceEnrollment
}) {
  return (
    <header className="dashboard-topbar glass-card">
      <AppBrand href="#/" subtitle="Student Workspace" />

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
          onClick={() => onNavigate("classrooms")}
        >
          Classrooms
        </button>
        <button
          className="dashboard-nav-button"
          type="button"
          onClick={() => onNavigate("performance")}
        >
          Performance
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
        <button
          className="dashboard-nav-button"
          type="button"
          onClick={onOpenFaceEnrollment}
        >
          Face Enrollment
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
