import { useEffect, useMemo, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  deleteAdminClassroom,
  deleteAdminUser,
  fetchAdminDashboard,
  updateAdminClassroomStatus,
  updateAdminUserEmailVerification
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { goToRoute } from "../../utils/router";
import "./AdminDashboardPage.css";

function summarizeDeletedCounts(deleted = {}) {
  const importantEntries = Object.entries(deleted)
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${value} ${key}`);

  return importantEntries.length
    ? importantEntries.slice(0, 5).join(", ")
    : "No linked records found";
}

function MetricCard({ label, value, helper }) {
  return (
    <article className="admin-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function EmptyState({ text }) {
  return <p className="admin-empty-state">{text}</p>;
}

export function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [status, setStatus] = useState({
    loading: true,
    message: ""
  });
  const [actionStatus, setActionStatus] = useState({
    pendingId: "",
    message: ""
  });

  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;

  async function loadDashboard(activeUser = user) {
    if (!activeUser || activeUser.role !== "admin") {
      return;
    }

    try {
      const response = await fetchAdminDashboard(activeUser.userId);
      setDashboard(response);
      setStatus({ loading: false, message: "" });
    } catch (error) {
      setStatus({
        loading: false,
        message:
          error instanceof Error ? error.message : "Unable to load admin dashboard."
      });
    }
  }

  useEffect(() => {
    if (!user || user.role !== "admin") {
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
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function runAdminAction(actionId, action) {
    setActionStatus({ pendingId: actionId, message: "" });

    try {
      const result = await action();
      setActionStatus({
        pendingId: "",
        message: result.message
          ? `${result.message} ${result.deleted ? summarizeDeletedCounts(result.deleted) : ""}`.trim()
          : "Admin action completed."
      });
      await loadDashboard();
    } catch (error) {
      setActionStatus({
        pendingId: "",
        message:
          error instanceof Error ? error.message : "Admin action could not finish."
      });
    }
  }

  function handleDeleteUser(targetUser) {
    const confirmed = window.confirm(
      `Delete ${targetUser.role} ${targetUser.name || targetUser.userId}? This will also remove linked records.`
    );

    if (!confirmed) {
      return;
    }

    void runAdminAction(`delete-user-${targetUser.userId}`, () =>
      deleteAdminUser(user.userId, targetUser.role, targetUser.userId)
    );
  }

  function handleToggleUserVerification(targetUser) {
    void runAdminAction(`verify-user-${targetUser.userId}`, () =>
      updateAdminUserEmailVerification(
        user.userId,
        targetUser.role,
        targetUser.userId,
        { emailVerified: !targetUser.emailVerified }
      )
    );
  }

  function handleDeleteClassroom(classroom) {
    const confirmed = window.confirm(
      `Delete ${classroom.subjectCode} - ${classroom.subjectName}? This will remove roster, attendance, drafts, exams, leave requests, assignments, QR sessions, and discussions for this class.`
    );

    if (!confirmed) {
      return;
    }

    void runAdminAction(`delete-class-${classroom.id}`, () =>
      deleteAdminClassroom(user.userId, classroom.id)
    );
  }

  function handleToggleClassroomStatus(classroom) {
    const nextStatus = classroom.status === "active" ? "archived" : "active";

    void runAdminAction(`status-class-${classroom.id}`, () =>
      updateAdminClassroomStatus(user.userId, classroom.id, {
        status: nextStatus
      })
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  if (status.loading) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard label="Loading" title="Preparing admin controls..." />
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
            label="Admin Error"
            title={status.message || "Unable to load admin dashboard."}
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

  const metrics = [
    {
      label: "Students",
      value: dashboard.metrics.students,
      helper: "Registered student accounts"
    },
    {
      label: "Teachers",
      value: dashboard.metrics.teachers,
      helper: "Faculty accounts"
    },
    {
      label: "Active Classes",
      value: dashboard.metrics.activeClasses,
      helper: `${dashboard.metrics.archivedClasses} archived`
    },
    {
      label: "Attendance Records",
      value: dashboard.metrics.attendanceRecords,
      helper: "Final records stored"
    }
  ];

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="dashboard-topbar glass-card">
        <AppBrand href="#/" subtitle="Admin Control Center" />

        <nav className="dashboard-nav">
          <button
            className="dashboard-nav-button"
            type="button"
            onClick={() => scrollToSection("admin-summary")}
          >
            Summary
          </button>
          <button
            className="dashboard-nav-button"
            type="button"
            onClick={() => scrollToSection("admin-users")}
          >
            Users
          </button>
          <button
            className="dashboard-nav-button"
            type="button"
            onClick={() => scrollToSection("admin-classes")}
          >
            Classes
          </button>
        </nav>

        <div className="dashboard-header-actions">
          <a className="ghost-button" href="#/">
            Home
          </a>
          <button className="primary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-shell admin-dashboard-shell">
        <section className="admin-hero glass-card" id="admin-summary">
          <div>
            <span className="pill">Admin</span>
            <h1>Platform control for classes, students, and teachers.</h1>
            <p>
              Use this workspace to clean incorrect records, archive classes,
              activate accounts, and remove users with their linked data.
            </p>
          </div>
          <div className="admin-login-note">
            <span>Signed in as</span>
            <strong>{dashboard.admin.name || dashboard.admin.userId}</strong>
            <small>ID {dashboard.admin.userId}</small>
          </div>
        </section>

        <section className="admin-metrics-grid">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </section>

        {actionStatus.message ? (
          <p className="admin-action-message">{actionStatus.message}</p>
        ) : null}

        <section className="admin-page-panel glass-card" id="admin-users">
          <div className="admin-section-header">
            <div>
              <span className="pill">Users</span>
              <h2>Student and teacher control.</h2>
            </div>
            <p>Verification toggles are useful when an account email needs manual activation.</p>
          </div>

          <div className="admin-two-column">
            <UserList
              title="Students"
              users={dashboard.students}
              pendingId={actionStatus.pendingId}
              onDelete={handleDeleteUser}
              onToggleVerification={handleToggleUserVerification}
            />
            <UserList
              title="Teachers"
              users={dashboard.teachers}
              pendingId={actionStatus.pendingId}
              onDelete={handleDeleteUser}
              onToggleVerification={handleToggleUserVerification}
            />
          </div>
        </section>

        <section className="admin-page-panel glass-card" id="admin-classes">
          <div className="admin-section-header">
            <div>
              <span className="pill">Classes</span>
              <h2>Classroom records and cleanup.</h2>
            </div>
            <p>Delete removes the class and linked academic records. Archive only hides it from active use.</p>
          </div>

          <div className="admin-class-list">
            {dashboard.classes.length ? (
              dashboard.classes.map((classroom) => (
                <article className="admin-class-row" key={classroom.id}>
                  <div>
                    <div className="admin-row-title">
                      <strong>
                        {classroom.subjectCode} - {classroom.subjectName}
                      </strong>
                      <span className={`admin-status-pill ${classroom.status}`}>
                        {classroom.status}
                      </span>
                    </div>
                    <p>
                      {classroom.teacherName} ({classroom.teacherUserId}) ·{" "}
                      {classroom.section || "No section"} · Join {classroom.joinCode}
                    </p>
                    <div className="admin-row-stats">
                      <span>{classroom.studentsCount} students</span>
                      <span>{classroom.attendanceRecordsCount} attendance records</span>
                    </div>
                  </div>
                  <div className="admin-row-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={actionStatus.pendingId === `status-class-${classroom.id}`}
                      onClick={() => handleToggleClassroomStatus(classroom)}
                    >
                      {classroom.status === "active" ? "Archive" : "Restore"}
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={actionStatus.pendingId === `delete-class-${classroom.id}`}
                      onClick={() => handleDeleteClassroom(classroom)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState text="No classes are stored yet." />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function UserList({
  title,
  users,
  pendingId,
  onDelete,
  onToggleVerification
}) {
  return (
    <div className="admin-user-group">
      <h3>{title}</h3>
      <div className="admin-user-list">
        {users.length ? (
          users.map((user) => (
            <article className="admin-user-row" key={`${user.role}-${user.userId}`}>
              <div>
                <div className="admin-row-title">
                  <strong>{user.name || user.userId}</strong>
                  <span
                    className={`admin-status-pill ${
                      user.emailVerified ? "active" : "archived"
                    }`}
                  >
                    {user.emailVerified ? "verified" : "unverified"}
                  </span>
                </div>
                <p>
                  {user.userId} · {user.email || "No email"}
                </p>
                <div className="admin-row-stats">
                  <span>{user.classesCount} classes</span>
                  <span>{user.attendanceRecordsCount} attendance</span>
                  {user.rollNumber ? <span>Roll {user.rollNumber}</span> : null}
                </div>
              </div>
              <div className="admin-row-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={pendingId === `verify-user-${user.userId}`}
                  onClick={() => onToggleVerification(user)}
                >
                  {user.emailVerified ? "Mark Unverified" : "Verify Email"}
                </button>
                <button
                  className="danger-button"
                  type="button"
                  disabled={pendingId === `delete-user-${user.userId}`}
                  onClick={() => onDelete(user)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <EmptyState text={`No ${title.toLowerCase()} found.`} />
        )}
      </div>
    </div>
  );
}
