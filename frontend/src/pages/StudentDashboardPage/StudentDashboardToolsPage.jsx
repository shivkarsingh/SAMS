import { useEffect, useMemo, useState } from "react";
import { DashboardPanelHeader } from "../../components/common/DashboardPanelHeader";
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
import { StudentExamSection } from "./components/StudentExamSection";
import { StudentFaceEnrollmentPreviewCard } from "./components/StudentFaceEnrollmentPreviewCard";
import { StudentInsightsSidebar } from "./components/StudentInsightsSidebar";
import { StudentScheduleSection } from "./components/StudentScheduleSection";
import {
  buildStudentNotifications,
  getStudentNotificationCount
} from "./studentNotifications";
import { readStoredStudentProfile } from "./studentProfileStore";
import "./StudentDashboardPage.css";

const toolConfigs = {
  classes: {
    navId: "classrooms",
    label: "Classrooms",
    title: "Classrooms and joined class tools",
    description:
      "Join a class, open each class page, and use class-specific notes, assignments, and discussion from dedicated pages."
  },
  performance: {
    navId: "performance",
    label: "Performance",
    title: "Attendance performance analytics",
    description:
      "Review subject-wise attendance, recovery needs, trend momentum, and class-average comparison."
  },
  schedule: {
    navId: "schedule",
    label: "Schedule",
    title: "Schedule and timetable",
    description:
      "See today's upcoming classes and your weekly timetable in a focused schedule workspace."
  },
  exams: {
    navId: "exams",
    label: "Exams",
    title: "Exam eligibility and attendance calculator",
    description:
      "Track upcoming exams, eligibility percentage, and minimum classes to attend before the exam date."
  },
  insights: {
    navId: "insights",
    label: "Insights",
    title: "Attendance coach and goals",
    description:
      "Use alerts, recovery plans, goals, and achievements to decide the next best action."
  },
  notifications: {
    navId: "notifications",
    label: "Notifications",
    title: "Notifications",
    description:
      "Important attendance, exam, leave, and setup updates collected in one student page."
  }
};

function getStudentNavItems(activeId) {
  return [
    { id: "overview", label: "Overview", route: "/student-dashboard" },
    { id: "classrooms", label: "Classrooms", route: "/student-classes" },
    { id: "performance", label: "Performance", route: "/student-performance" },
    { id: "schedule", label: "Schedule", route: "/student-schedule" },
    { id: "exams", label: "Exams", route: "/student-exams" },
    { id: "insights", label: "Insights", route: "/student-insights" }
  ].map((item) => ({
    ...item,
    active: item.id === activeId
  }));
}

function StudentNotificationsPanel({ dashboard }) {
  const notifications = buildStudentNotifications(dashboard);

  return (
    <section className="student-notifications-page-grid">
      <article className="glass-card dashboard-panel student-notifications-panel">
        <DashboardPanelHeader
          label="Notification Center"
          title={`${notifications.length} update${notifications.length === 1 ? "" : "s"} for you`}
          description="Open the linked page from each notification instead of hunting through the dashboard."
        />

        <div className="student-notification-list">
          {notifications.map((notification) => (
            <article
              key={notification.id}
              className={`student-notification-card ${notification.tone}`}
            >
              <div className="student-notification-main">
                <span>{notification.category}</span>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => goToRoute(notification.route)}
              >
                Open
              </button>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}

export function StudentDashboardToolsPage({ view }) {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const config = toolConfigs[view] ?? toolConfigs.classes;
  const [dashboard, setDashboard] = useState(null);
  const [status, setStatus] = useState({
    loading: true,
    message: ""
  });

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
          ...(readStoredStudentProfile(activeUser.userId) ?? {})
        }
      });
      setStatus({
        loading: false,
        message: ""
      });
    } catch (error) {
      setStatus({
        loading: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to load this student page."
      });
    }
  }

  useEffect(() => {
    if (!user || user.role !== "student") {
      goToRoute("/login");
      return;
    }

    void loadDashboard();
  }, [user, view]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
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
          <LoadingCard label="Loading" title={`Preparing ${config.label}...`} />
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
            label="Student Page Error"
            title={status.message || "Unable to load this student page."}
            action={
              <button
                className="secondary-button"
                type="button"
                onClick={() => goToRoute("/student-dashboard")}
              >
                Back to Dashboard
              </button>
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
        onOpenFaceEnrollment={() => goToRoute("/student-face-enrollment")}
        notificationCount={notificationCount}
        navItems={getStudentNavItems(config.navId)}
        utilityAction={{
          label: "Dashboard",
          onClick: () => goToRoute("/student-dashboard")
        }}
      />

      <main className="dashboard-shell">
        <section className="glass-card dashboard-panel student-tool-page-hero">
          <span className="pill">Student {config.label}</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </section>

        {view === "classes" ? (
          <>
            <section className="dashboard-lower-grid">
              <StudentClassroomSection
                joinedClasses={joinedClassCards}
                onJoinClass={handleJoinClass}
              />
              <StudentFaceEnrollmentPreviewCard
                faceProfile={dashboard.faceProfile}
                onOpenFaceEnrollment={() => goToRoute("/student-face-enrollment")}
              />
            </section>
            <StudentClassesPanel classes={dashboard.classPerformance} />
          </>
        ) : null}

        {view === "performance" ? (
          <section className="dashboard-main-grid">
            <StudentClassesPanel classes={dashboard.classPerformance} />
            <StudentInsightsSidebar
              attendanceTrend={dashboard.attendanceTrend}
              peerComparison={dashboard.peerComparison}
            />
          </section>
        ) : null}

        {view === "schedule" ? (
          <StudentScheduleSection
            upcomingClasses={dashboard.upcomingClasses}
            weeklySchedule={dashboard.weeklySchedule}
          />
        ) : null}

        {view === "exams" ? (
          <StudentExamSection
            upcomingExams={dashboard.upcomingExams ?? []}
            classes={dashboard.classPerformance}
          />
        ) : null}

        {view === "insights" ? (
          <StudentAttentionSection
            alerts={dashboard.alerts}
            goals={dashboard.goals}
            achievements={dashboard.achievements}
            aiCoach={dashboard.aiCoach}
            recoveryPlan={dashboard.recoveryPlan}
          />
        ) : null}

        {view === "notifications" ? (
          <StudentNotificationsPanel dashboard={dashboard} />
        ) : null}
      </main>
    </div>
  );
}
