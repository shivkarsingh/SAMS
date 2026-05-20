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

export function TeacherHeroSection() {
  return (
    <section className="teacher-dashboard-greeting" id="overview">
      <h1>{getTimeGreeting()}</h1>
    </section>
  );
}
