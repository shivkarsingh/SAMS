import { AppBrand } from "../../../components/common/AppBrand";
import { goToRoute } from "../../../utils/router";

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="student-notification-bell-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M18 9.6c0-3.2-2.1-5.6-5-6.1V2.8a1 1 0 0 0-2 0v.7c-2.9.5-5 2.9-5 6.1v3.1c0 .9-.3 1.7-.9 2.4l-.8 1a.9.9 0 0 0 .7 1.5h14a.9.9 0 0 0 .7-1.5l-.8-1c-.6-.7-.9-1.5-.9-2.4V9.6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.7 20a2.6 2.6 0 0 0 4.6 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function StudentDashboardHeader({
  onLogout,
  onNavigate = null,
  onOpenFaceEnrollment,
  notificationCount = 0,
  showNotificationBell = true,
  utilityAction = null,
  navItems = [
    { id: "overview", label: "Overview", route: "/student-dashboard" },
    { id: "classrooms", label: "Classrooms", route: "/student-classes" },
    { id: "performance", label: "Performance", route: "/student-performance" },
    { id: "schedule", label: "Schedule", route: "/student-schedule" },
    { id: "exams", label: "Exams", route: "/student-exams" },
    { id: "insights", label: "Insights", route: "/student-insights" }
  ]
}) {
  function handleNavigation(item) {
    if (item.route) {
      goToRoute(item.route);
      return;
    }

    onNavigate?.(item.id);
  }

  return (
    <header className="dashboard-topbar glass-card">
      <AppBrand href="#/" subtitle="Student Workspace" />

      {navItems.length ? (
        <nav className="dashboard-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`dashboard-nav-button ${item.active ? "active-student-nav" : ""}`}
              type="button"
              onClick={() => handleNavigation(item)}
            >
              {item.label}
            </button>
          ))}
          <button
            className="dashboard-nav-button"
            type="button"
            onClick={onOpenFaceEnrollment}
          >
            Face Enrollment
          </button>
        </nav>
      ) : (
        <div />
      )}

      <div className="dashboard-header-actions">
        <a className="ghost-button" href="#/">
          Home
        </a>
        {showNotificationBell ? (
          <button
            className="student-notification-button"
            type="button"
            aria-label={`Open notifications${notificationCount ? `, ${notificationCount} needs attention` : ""}`}
            onClick={() => goToRoute("/student-notifications")}
          >
            <BellIcon />
            {notificationCount ? (
              <span className="student-notification-count">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            ) : null}
          </button>
        ) : null}
        {utilityAction ? (
          <button
            className={utilityAction.className ?? "secondary-button"}
            type="button"
            onClick={utilityAction.onClick}
          >
            {utilityAction.label}
          </button>
        ) : (
          <button
            className="secondary-button"
            type="button"
            onClick={() => goToRoute("/student-profile")}
          >
            Profile
          </button>
        )}
        <button className="primary-button" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
