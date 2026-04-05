import { useEffect, useMemo, useState } from "react";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  fetchStudentDashboard,
  joinStudentClass
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { goToRoute } from "../../utils/router";
import { StudentAttentionSection } from "./components/StudentAttentionSection";
import { StudentClassroomSection } from "./components/StudentClassroomSection";
import { StudentClassesPanel } from "./components/StudentClassesPanel";
import { StudentDashboardHeader } from "./components/StudentDashboardHeader";
import { StudentFaceEnrollmentPreviewCard } from "./components/StudentFaceEnrollmentPreviewCard";
import { StudentHeroSection } from "./components/StudentHeroSection";
import { StudentInsightsSidebar } from "./components/StudentInsightsSidebar";
import { StudentScheduleSection } from "./components/StudentScheduleSection";
import { StudentSummaryGrid } from "./components/StudentSummaryGrid";
import "./StudentDashboardPage.css";

export function StudentDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [status, setStatus] = useState({
    loading: true,
    message: ""
  });

  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;

  async function loadDashboard(activeUser = user) {
    if (!activeUser || activeUser.role !== "student") {
      return;
    }

    try {
      const response = await fetchStudentDashboard(activeUser.userId);
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
            : "Unable to load student dashboard."
      });
    }
  }

  useEffect(() => {
    if (!user || user.role !== "student") {
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

  async function handleJoinClass(joinInput) {
    const result = await joinStudentClass(user.userId, {
      joinInput
    });

    await loadDashboard();
    return result;
  }

  if (!user || user.role !== "student") {
    return null;
  }

  if (status.loading) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard
            label="Loading"
            title="Preparing your attendance dashboard..."
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
            title={status.message || "Unable to load dashboard."}
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

  const performanceLeader = [...dashboard.classPerformance].sort(
    (left, right) => right.studentPercentage - left.studentPercentage
  )[0];

  return (
    <div className="page-shell">
      <PageBackground />

      <StudentDashboardHeader
        onLogout={handleLogout}
        onNavigate={scrollToSection}
        onOpenFaceEnrollment={() => goToRoute("/student-face-enrollment")}
      />

      <main className="dashboard-shell">
        <StudentHeroSection
          profile={dashboard.profile}
          overview={dashboard.overview}
          faceProfile={dashboard.faceProfile}
          onOpenClassrooms={() => scrollToSection("classrooms")}
          onReviewPerformance={() => scrollToSection("performance")}
          onOpenSchedule={() => scrollToSection("schedule")}
          onOpenFaceEnrollment={() => goToRoute("/student-face-enrollment")}
        />

        <StudentSummaryGrid
          dashboard={dashboard}
          performanceLeader={performanceLeader}
        />

        <section className="dashboard-lower-grid">
          <StudentClassroomSection
            joinedClasses={dashboard.joinedClasses}
            onJoinClass={handleJoinClass}
          />
          <StudentFaceEnrollmentPreviewCard
            faceProfile={dashboard.faceProfile}
            onOpenFaceEnrollment={() => goToRoute("/student-face-enrollment")}
          />
        </section>

        <section className="dashboard-main-grid">
          <StudentClassesPanel classes={dashboard.classPerformance} />
          <StudentInsightsSidebar
            attendanceTrend={dashboard.attendanceTrend}
            peerComparison={dashboard.peerComparison}
          />
        </section>

        <StudentScheduleSection
          upcomingClasses={dashboard.upcomingClasses}
          weeklySchedule={dashboard.weeklySchedule}
        />

        <StudentAttentionSection
          alerts={dashboard.alerts}
          goals={dashboard.goals}
          achievements={dashboard.achievements}
        />
      </main>
    </div>
  );
}
