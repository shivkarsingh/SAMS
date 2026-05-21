function getTimeGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function TeacherHeroSection({
  onOpenClasses,
  onCreateClass,
  onOpenTodos
}) {
  return (
    <section className="teacher-dashboard-greeting" id="overview">
      <span className="pill">Teacher Dashboard</span>
      <h1>{getTimeGreeting()}</h1>
      <div className="dashboard-actions">
        <button className="primary-button" type="button" onClick={onOpenClasses}>
          View Classes
        </button>
        <button className="secondary-button" type="button" onClick={onCreateClass}>
          Create Class
        </button>
        <button className="secondary-button" type="button" onClick={onOpenTodos}>
          Open To Do
        </button>
      </div>
    </section>
  );
}
