import { AppBrand } from "../../../components/common/AppBrand";
import { goToRoute } from "../../../utils/router";

export function TeacherDashboardHeader({
  onLogout,
  onNavigate,
  navItems = [],
  utilityAction = null
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
      <AppBrand href="#/" subtitle="Teacher Workspace" />

      {navItems.length ? (
        <nav className="dashboard-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`dashboard-nav-button ${item.active ? "active-teacher-nav" : ""}`}
              type="button"
              onClick={() => handleNavigation(item)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      ) : (
        <div />
      )}

      <div className="dashboard-header-actions">
        <a className="ghost-button" href="#/">
          Home
        </a>
        {utilityAction ? (
          <button
            className={utilityAction.className ?? "secondary-button"}
            type="button"
            onClick={utilityAction.onClick}
          >
            {utilityAction.label}
          </button>
        ) : null}
        <button className="primary-button" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
