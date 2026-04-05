import { useEffect, useMemo, useState } from "react";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  createTeacherClass,
  fetchTeacherDashboard
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { goToRoute } from "../../utils/router";
import { TeacherActionSection } from "./components/TeacherActionSection";
import { TeacherClassCreationSection } from "./components/TeacherClassCreationSection";
import { TeacherClassesPanel } from "./components/TeacherClassesPanel";
import { TeacherDashboardHeader } from "./components/TeacherDashboardHeader";
import { TeacherHeroSection } from "./components/TeacherHeroSection";
import { TeacherInsightsSidebar } from "./components/TeacherInsightsSidebar";
import { TeacherScheduleSection } from "./components/TeacherScheduleSection";
import { TeacherSummaryGrid } from "./components/TeacherSummaryGrid";
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
      />

      <main className="dashboard-shell">
        <TeacherHeroSection
          profile={dashboard.profile}
          overview={dashboard.overview}
          onOpenClasses={() => scrollToSection("classes")}
          onOpenSchedule={() => scrollToSection("schedule")}
        />

        <TeacherSummaryGrid
          overview={dashboard.overview}
          priorities={dashboard.priorities}
        />

        <TeacherClassCreationSection
          classesManaged={dashboard.classesManaged}
          onCreateClass={handleCreateClass}
          onOpenClassroom={openClassroom}
        />

        <section className="dashboard-main-grid">
          <TeacherClassesPanel
            classesManaged={dashboard.classesManaged}
            onOpenClassroom={openClassroom}
          />
          <TeacherInsightsSidebar
            attendanceTrend={dashboard.attendanceTrend}
            sectionComparison={dashboard.sectionComparison}
          />
        </section>

        <TeacherScheduleSection
          todaysSchedule={dashboard.todaysSchedule}
          weeklySchedule={dashboard.weeklySchedule}
        />

        <TeacherActionSection
          studentWatchlist={dashboard.studentWatchlist}
          quickInsights={dashboard.quickInsights}
          recentActivity={dashboard.recentActivity}
          priorities={dashboard.priorities}
        />
      </main>
    </div>
  );
}
