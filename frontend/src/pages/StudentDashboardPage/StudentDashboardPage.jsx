import { useEffect, useMemo, useState } from "react";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  fetchStudentDashboard,
  joinStudentClass
} from "../../services/api";
import {
  clearPendingJoinCode,
  clearSession,
  getPendingJoinCode,
  getSession
} from "../../services/session";
import { getHashSearchParam, goToRoute } from "../../utils/router";
import { StudentClassroomSection } from "./components/StudentClassroomSection";
import { StudentDashboardHeader } from "./components/StudentDashboardHeader";
import { StudentHeroSection } from "./components/StudentHeroSection";
import { StudentScheduleSection } from "./components/StudentScheduleSection";
import { StudentSummaryGrid } from "./components/StudentSummaryGrid";
import { StudentToolsSection } from "./components/StudentToolsSection";
import { getStudentNotificationCount } from "./studentNotifications";
import { readStoredStudentProfile } from "./studentProfileStore";
import "./StudentDashboardPage.css";

export function StudentDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [status, setStatus] = useState({
    loading: true,
    message: ""
  });

  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const initialJoinInput = useMemo(
    () =>
      getHashSearchParam("joinCode") ??
      getHashSearchParam("code") ??
      getPendingJoinCode() ??
      "",
    []
  );

  async function loadDashboard(activeUser = user) {
    if (!activeUser || activeUser.role !== "student") {
      return;
    }

    try {
      const response = await fetchStudentDashboard(activeUser.userId);
      setDashboard({
        ...response,
        profile: {
          ...activeUser,
          ...response.profile,
          ...(readStoredStudentProfile(activeUser.userId) ?? {}),
          faceProfilePhotoUrl:
            response.faceProfile?.profilePhotoUrl ??
            response.profile?.faceProfilePhotoUrl ??
            ""
        }
      });
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

  async function handleJoinClass(joinInput) {
    const result = await joinStudentClass(user.userId, {
      joinInput
    });

    clearPendingJoinCode();
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

  const performanceByClassId = new Map(
    dashboard.classPerformance.map((course) => [course.id, course])
  );
  const joinedClassCards = dashboard.joinedClasses.map((joinedClass) => ({
    ...joinedClass,
    analytics: performanceByClassId.get(joinedClass.id)
  }));
  const notificationCount = getStudentNotificationCount(dashboard);

  return (
    <div className="page-shell">
      <PageBackground />

      <StudentDashboardHeader
        onLogout={handleLogout}
        notificationCount={notificationCount}
        showNotificationBell={false}
        navItems={[]}
      />

      <main className="dashboard-shell">
        <StudentHeroSection
          profile={dashboard.profile}
          overview={dashboard.overview}
          faceProfile={dashboard.faceProfile}
        />

        <StudentSummaryGrid dashboard={dashboard} />

        <StudentToolsSection
          onOpenFaceEnrollment={() => goToRoute("/student-face-enrollment")}
          onOpenAttendanceCalculator={() => goToRoute("/student-calculator")}
          onOpenCalendar={() => goToRoute("/student-calendar")}
          onOpenExamEligibility={() => goToRoute("/student-exams")}
          onOpenNotifications={() => goToRoute("/student-notifications")}
          onReviewPerformance={() => goToRoute("/student-performance")}
          onOpenClassrooms={() => goToRoute("/student-classes")}
          onOpenTodos={() => goToRoute("/student-todos")}
          notificationCount={notificationCount}
        />

        <StudentClassroomSection
          joinedClasses={joinedClassCards}
          onJoinClass={handleJoinClass}
          initialJoinInput={initialJoinInput}
          showJoinedClasses={false}
          label="Join Classroom"
          title="Join a classroom from the dashboard."
          description="Paste the join code shared by your teacher. Open joined classes from the Classes Joined button."
        />

        <StudentScheduleSection
          upcomingClasses={dashboard.upcomingClasses}
          weeklySchedule={dashboard.weeklySchedule}
        />
      </main>
    </div>
  );
}
