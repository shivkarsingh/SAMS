import { useEffect, useMemo, useState } from "react";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import { TodoPanel } from "../../components/common/TodoPanel";
import {
  createTeacherClass,
  fetchTeacherDashboard
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { goToRoute } from "../../utils/router";
import { TeacherClassesPanel } from "./components/TeacherClassesPanel";
import { TeacherClassCreationSection } from "./components/TeacherClassCreationSection";
import { TeacherDashboardHeader } from "./components/TeacherDashboardHeader";
import "./TeacherDashboardPage.css";

const toolConfigs = {
  classes: {
    navId: "classes",
    label: "Classes",
    title: "Class sections",
    description: ""
  },
  "create-class": {
    navId: "class-management",
    label: "Create Class",
    title: "Create a class section",
    description:
      "Set the subject, room, semester, and weekly schedule before sharing the join code."
  },
  todos: {
    navId: "todos",
    label: "To Do",
    title: "To-do list",
    description:
      "Track teaching tasks, class prep, reminders, and follow-ups in one focused page."
  }
};

function getTeacherNavItems(activeId) {
  return [
    { id: "dashboard", label: "Dashboard", route: "/teacher-dashboard" },
    { id: "classes", label: "Classes", route: "/teacher-classes" },
    { id: "exams", label: "Calendar", route: "/teacher-dashboard?section=exams" },
    { id: "schedule", label: "Schedule", route: "/teacher-dashboard?section=schedule" },
    { id: "todos", label: "To Do", route: "/teacher-todos" },
    { id: "class-management", label: "Create Class", route: "/teacher-create-class" }
  ].map((item) => ({
    ...item,
    active: item.id === activeId
  }));
}

export function TeacherDashboardToolsPage({ view }) {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const activeView = toolConfigs[view] ? view : "classes";
  const config = toolConfigs[activeView];
  const [dashboard, setDashboard] = useState(null);
  const [status, setStatus] = useState({
    loading: true,
    message: ""
  });

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
    } catch (error) {
      setStatus({
        loading: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to load this teacher page."
      });
    }
  }

  useEffect(() => {
    if (!user || user.role !== "teacher") {
      goToRoute("/login");
      return;
    }

    void loadDashboard();
  }, [user, activeView]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
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
            label="Teacher Page Error"
            title={status.message || "Unable to load this teacher page."}
            action={
              <button
                className="secondary-button"
                type="button"
                onClick={() => goToRoute("/teacher-dashboard")}
              >
                Back to Dashboard
              </button>
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
        navItems={getTeacherNavItems(config.navId)}
        utilityAction={{
          label: "Profile",
          className: "secondary-button",
          onClick: () => goToRoute("/teacher-profile")
        }}
      />

      <main className="dashboard-shell">
        <section className="glass-card dashboard-panel teacher-tool-page-hero">
          <span className="pill">Teacher {config.label}</span>
          <h1>{config.title}</h1>
          {config.description ? <p>{config.description}</p> : null}
        </section>

        {activeView === "classes" ? (
          <TeacherClassesPanel
            classesManaged={dashboard.classesManaged ?? []}
            onOpenClassroom={openClassroom}
          />
        ) : null}

        {activeView === "create-class" ? (
          <TeacherClassCreationSection onCreateClass={handleCreateClass} />
        ) : null}

        {activeView === "todos" ? (
          <TodoPanel role="teacher" userId={user.userId} />
        ) : null}
      </main>
    </div>
  );
}
