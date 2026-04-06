import { useEffect, useMemo, useState } from "react";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  createTeacherClass,
  fetchTeacherDashboard
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { goToRoute } from "../../utils/router";
import { TeacherClassCreationSection } from "./components/TeacherClassCreationSection";
import { TeacherDashboardHeader } from "./components/TeacherDashboardHeader";
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

  async function handleCreateClass(form) {
    const result = await createTeacherClass(user.userId, form);
    await loadDashboard();
    return result;
  }

  function openClassroom(classId) {
    goToRoute(`/teacher-classroom?classId=${encodeURIComponent(classId)}`);
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
          { id: "overview", label: "Overview" },
          { id: "classes", label: "Manage Classes" },
          { id: "class-management", label: "Create Class" }
        ]}
        utilityAction={{
          label: "Profile",
          className: "secondary-button",
          onClick: () => goToRoute("/teacher-profile")
        }}
      />

      <main className="dashboard-shell">
        <section className="teacher-dashboard-greeting" id="overview">
          <h1>Good to see you</h1>
        </section>

        <TeacherClassCreationSection
          classesManaged={dashboard.classesManaged}
          onCreateClass={handleCreateClass}
          onOpenClassroom={openClassroom}
        />
      </main>
    </div>
  );
}
