import { useEffect, useMemo, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import { fetchTeacherClassroom } from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { getHashSearchParam, goToRoute } from "../../utils/router";
import "../TeacherDashboardPage/TeacherDashboardPage.css";
import "../TeacherClassroomPage/TeacherClassroomPage.css";

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function TeacherClassroomSessionsPage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const classId = getHashSearchParam("classId");
  const [classroomData, setClassroomData] = useState(null);
  const [pageStatus, setPageStatus] = useState({
    loading: true,
    message: ""
  });

  useEffect(() => {
    if (!user || user.role !== "teacher") {
      goToRoute("/login");
      return;
    }

    if (!classId) {
      setPageStatus({
        loading: false,
        message: "A classroom ID is required to open recent sessions."
      });
      return;
    }

    async function loadClassroom() {
      try {
        const response = await fetchTeacherClassroom(user.userId, classId);
        setClassroomData(response);
        setPageStatus({
          loading: false,
          message: ""
        });
      } catch (error) {
        setPageStatus({
          loading: false,
          message:
            error instanceof Error
              ? error.message
              : "Unable to load recent sessions."
        });
      }
    }

    void loadClassroom();
  }, [classId, user]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
  }

  if (!user || user.role !== "teacher") {
    return null;
  }

  if (pageStatus.loading) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard label="Loading" title="Preparing recent sessions..." />
        </main>
      </div>
    );
  }

  if (!classroomData) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard
            label="Sessions Error"
            title={pageStatus.message || "Unable to load recent sessions."}
            action={
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  goToRoute(`/teacher-classroom?classId=${encodeURIComponent(classId ?? "")}`)
                }
              >
                Back to Class
              </button>
            }
          />
        </main>
      </div>
    );
  }

  const { classroom, attendanceHistory } = classroomData;

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="dashboard-topbar glass-card">
        <AppBrand href="#/" subtitle="Teacher Classroom Sessions" />

        <nav className="dashboard-nav">
          <button
            className="dashboard-nav-button"
            type="button"
            onClick={() =>
              goToRoute(`/teacher-classroom?classId=${encodeURIComponent(classId)}`)
            }
          >
            Class Workspace
          </button>
          <button className="dashboard-nav-button active-teacher-nav" type="button">
            Recent Sessions
          </button>
        </nav>

        <div className="dashboard-header-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              goToRoute(`/teacher-classroom?classId=${encodeURIComponent(classId)}`)
            }
          >
            Back to Class
          </button>
          <button className="primary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-shell">
        <section className="teacher-dashboard-greeting">
          <h1>Recent Sessions</h1>
          <p className="course-meta">
            {classroom.subjectName} • {classroom.subjectCode} • {classroom.section}
          </p>
        </section>

        <section className="glass-card dashboard-panel teacher-sessions-page-panel">
          {attendanceHistory.length ? (
            <div className="teacher-sessions-list">
              {attendanceHistory.map((sessionItem) => (
                <article key={sessionItem.sessionId} className="timeline-card">
                  <div className="timeline-time">
                    <span>Recorded</span>
                    <strong>{formatDateTime(sessionItem.recordedAt)}</strong>
                  </div>
                  <div className="timeline-content">
                    <strong>
                      {sessionItem.presentCount} present • {sessionItem.absentCount} absent
                    </strong>
                    <p>Session ID: {sessionItem.sessionId}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="panel-fallback">
              Finalized attendance sessions will appear here after the first submission.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
