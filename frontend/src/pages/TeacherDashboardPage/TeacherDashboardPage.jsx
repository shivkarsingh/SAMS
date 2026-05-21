import { useEffect, useMemo, useState } from "react";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import { fetchTeacherDashboard } from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { getHashSearchParam, goToRoute } from "../../utils/router";
import { TeacherDashboardHeader } from "./components/TeacherDashboardHeader";
import { TeacherExamsSection } from "./components/TeacherExamsSection";
import { TeacherHeroSection } from "./components/TeacherHeroSection";
import { TeacherScheduleSection } from "./components/TeacherScheduleSection";
import "./TeacherDashboardPage.css";

export function TeacherDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [status, setStatus] = useState({
    loading: true,
    message: ""
  });

  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;

  async function loadDashboard(activeUser = user) {
    if (!activeUser || activeUser.role !== "teacher") {
      return;
    }

    try {
      const response = await fetchTeacherDashboard(activeUser.userId);
      setDashboard(response);
      setStatus({
        loading: false,
        message: ""
      });
    } catch (dashboardError) {
      setStatus({
        loading: false,
        message:
          dashboardError instanceof Error
            ? dashboardError.message
            : "Unable to load teacher dashboard."
      });
    }
  }

  useEffect(() => {
    if (!user || user.role !== "teacher") {
      goToRoute("/login");
      return;
    }

    void loadDashboard();
  }, [user]);

  useEffect(() => {
    if (!dashboard) {
      return;
    }

    const sectionId = getHashSearchParam("section");

    if (sectionId === "exams" || sectionId === "schedule") {
      window.requestAnimationFrame(() => scrollToSection(sectionId));
    }
  }, [dashboard]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
  }

  function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);

    if (section) {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  if (!user || user.role !== "teacher") {
    return null;
  }

  if (status.loading) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard
            label="Loading"
            title="Preparing your teacher dashboard..."
          />
        </main>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard
            label="Dashboard Error"
            title={status.message || "Unable to load teacher dashboard."}
            action={
              <a className="secondary-button" href="#/login">
                Back to Login
              </a>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageBackground />

      <TeacherDashboardHeader
        onLogout={handleLogout}
        onNavigate={scrollToSection}
        navItems={[
          { id: "classes", label: "Classes", route: "/teacher-classes" },
          { id: "exams", label: "Calendar" },
          { id: "schedule", label: "Schedule" },
          { id: "todos", label: "To Do", route: "/teacher-todos" },
          { id: "class-management", label: "Create Class", route: "/teacher-create-class" }
        ]}
        utilityAction={{
          label: "Profile",
          className: "secondary-button",
          onClick: () => goToRoute("/teacher-profile")
        }}
      />

      <main className="dashboard-shell">
        <TeacherHeroSection
          onOpenClasses={() => goToRoute("/teacher-classes")}
          onCreateClass={() => goToRoute("/teacher-create-class")}
          onOpenTodos={() => goToRoute("/teacher-todos")}
        />

        <TeacherExamsSection
          upcomingExams={dashboard.upcomingExams ?? []}
          classesManaged={dashboard.classesManaged ?? []}
        />

        <TeacherScheduleSection
          todaysSchedule={dashboard.todaysSchedule}
          weeklySchedule={dashboard.weeklySchedule}
        />
      </main>
    </div>
  );
}
