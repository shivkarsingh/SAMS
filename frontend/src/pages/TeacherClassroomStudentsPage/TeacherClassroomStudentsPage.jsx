import { useEffect, useMemo, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import { fetchTeacherClassroom } from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { getHashSearchParam, goToRoute } from "../../utils/router";
import "../TeacherDashboardPage/TeacherDashboardPage.css";
import "../TeacherClassroomPage/TeacherClassroomPage.css";
import "./TeacherClassroomStudentsPage.css";

const attendanceFilters = [
  { id: "all", label: "All Students" },
  { id: "low", label: "Low Attendance" },
  { id: "high", label: "High Attendance" }
];

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export function TeacherClassroomStudentsPage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const classId = getHashSearchParam("classId");
  const [classroomData, setClassroomData] = useState(null);
  const [pageStatus, setPageStatus] = useState({
    loading: true,
    message: ""
  });
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    if (!user || user.role !== "teacher") {
      goToRoute("/login");
      return;
    }

    if (!classId) {
      setPageStatus({
        loading: false,
        message: "A classroom ID is required to open student details."
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
              : "Unable to load student details."
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
          <LoadingCard label="Loading" title="Preparing student details..." />
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
            label="Student Details Error"
            title={pageStatus.message || "Unable to load student details."}
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

  const { classroom, overview, roster } = classroomData;
  const enrolledCount = roster.length;
  const faceAddedCount = roster.filter(
    (student) => student.faceProfileStatus === "enrolled"
  ).length;
  const lowAttendanceCount = roster.filter(
    (student) => student.attendancePercentage < overview.lowAttendanceThreshold
  ).length;

  const filteredStudents = roster
    .filter((student) => {
      if (activeFilter === "low") {
        return student.attendancePercentage < overview.lowAttendanceThreshold;
      }

      if (activeFilter === "high") {
        return student.attendancePercentage >= overview.lowAttendanceThreshold;
      }

      return true;
    })
    .sort((left, right) => {
      if (activeFilter === "low") {
        return left.attendancePercentage - right.attendancePercentage;
      }

      if (activeFilter === "high") {
        return right.attendancePercentage - left.attendancePercentage;
      }

      return right.attendancePercentage - left.attendancePercentage;
    });

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="dashboard-topbar glass-card">
        <AppBrand href="#/" subtitle="Teacher Student Details" />

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
            Student Details
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
          <h1>Student Details</h1>
          <p className="course-meta">
            {classroom.subjectName} • {classroom.subjectCode} • {classroom.section}
          </p>
        </section>

        <section className="dashboard-profile-strip teacher-student-summary-strip">
          <div>
            <span>Students Enrolled</span>
            <strong>{enrolledCount}</strong>
          </div>
          <div>
            <span>Face Added</span>
            <strong>{faceAddedCount}</strong>
          </div>
          <div>
            <span>Avg Attendance</span>
            <strong>{overview.averageAttendance}%</strong>
          </div>
          <div>
            <span>Below Safe Range</span>
            <strong>{lowAttendanceCount}</strong>
          </div>
        </section>

        <section className="glass-card dashboard-panel teacher-student-filter-panel">
          <div className="dashboard-panel-header">
            <div>
              <span className="pill">Filters</span>
              <h2>Review students by attendance level.</h2>
            </div>
          </div>

          <div className="teacher-student-filter-row">
            {attendanceFilters.map((filter) => (
              <button
                key={filter.id}
                className={`role-tab ${activeFilter === filter.id ? "active" : ""}`}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="teacher-student-list">
            {filteredStudents.length ? (
              filteredStudents.map((student) => (
                <article key={student.studentUserId} className="teacher-student-card">
                  <div className="teacher-student-card-head">
                    <div>
                      <h3>{student.studentName}</h3>
                      <span>{student.studentUserId}</span>
                    </div>
                    <span
                      className={`teacher-status-pill ${
                        student.faceProfileStatus === "enrolled" ? "submitted" : "pending"
                      }`}
                    >
                      {student.faceProfileStatus === "enrolled"
                        ? "Face Added"
                        : "Face Pending"}
                    </span>
                  </div>

                  <div className="teacher-student-metrics">
                    <div>
                      <span>Attendance</span>
                      <strong>{student.attendancePercentage}%</strong>
                    </div>
                    <div>
                      <span>Sessions</span>
                      <strong>
                        {student.sessionsAttended}/{student.sessionsHeld || 0}
                      </strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{student.latestStatus}</strong>
                    </div>
                  </div>

                  <p className="course-meta">
                    {student.department || classroom.batch || "Batch pending"} • Joined{" "}
                    {formatDateTime(student.joinedAt)}
                  </p>
                </article>
              ))
            ) : (
              <p className="panel-fallback">
                No students match this attendance filter right now.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
