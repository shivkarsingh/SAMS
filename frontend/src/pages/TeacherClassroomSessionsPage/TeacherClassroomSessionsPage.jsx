import { useEffect, useMemo, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  fetchTeacherClassroom,
  updateSessionAttendanceRecord
} from "../../services/api";
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

function normalizeAttendanceStatus(status) {
  const normalizedStatus = String(status ?? "").trim().toLowerCase();

  if (["present", "late", "cancelled"].includes(normalizedStatus)) {
    return normalizedStatus;
  }

  return "absent";
}

function formatStatusLabel(status) {
  const normalizedStatus = normalizeAttendanceStatus(status);

  if (normalizedStatus === "late") {
    return "Late";
  }

  if (normalizedStatus === "cancelled") {
    return "Cancelled";
  }

  return normalizedStatus === "present" ? "Present" : "Absent";
}

function groupSessionStudents(sessionItem) {
  const students = Array.isArray(sessionItem?.students) ? sessionItem.students : [];
  const presentStudents = students.filter((student) =>
    ["present", "late"].includes(normalizeAttendanceStatus(student.status))
  );
  const absentStudents = students.filter(
    (student) => normalizeAttendanceStatus(student.status) === "absent"
  );
  const cancelledStudents = students.filter(
    (student) => normalizeAttendanceStatus(student.status) === "cancelled"
  );

  return {
    students,
    presentStudents,
    absentStudents,
    cancelledStudents
  };
}

function getInitials(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getStudentPhotoUrl(student, rosterStudent) {
  return (
    student?.profilePhotoUrl ||
    student?.avatarDataUrl ||
    student?.faceProfilePhotoUrl ||
    student?.avatarUrl ||
    rosterStudent?.profilePhotoUrl ||
    rosterStudent?.avatarDataUrl ||
    rosterStudent?.faceProfilePhotoUrl ||
    rosterStudent?.avatarUrl ||
    ""
  );
}

function SessionStudentAvatar({ student, rosterStudent }) {
  const displayName =
    student?.studentName ||
    rosterStudent?.studentName ||
    student?.studentUserId ||
    rosterStudent?.studentUserId ||
    "Student";
  const photoUrl = getStudentPhotoUrl(student, rosterStudent);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [photoUrl]);

  return (
    <span className="teacher-session-avatar" aria-hidden="true">
      {photoUrl && !imageFailed ? (
        <img src={photoUrl} alt="" onError={() => setImageFailed(true)} />
      ) : (
        getInitials(displayName)
      )}
    </span>
  );
}

function getStudentKey(student, index) {
  return `${student.studentUserId || student.studentId || student.rollNumber || "student"}-${index}`;
}

function getStudentId(student) {
  return String(student?.studentUserId || student?.studentId || "").trim();
}

function buildRosterByStudentId(roster = []) {
  return new Map(
    roster
      .map((student) => [getStudentId(student), student])
      .filter(([studentId]) => studentId)
  );
}

function SessionStudentGroup({
  title,
  students,
  tone,
  emptyText,
  sessionId,
  pendingStudentId,
  onStatusChange,
  rosterByStudentId = new Map()
}) {
  return (
    <section className={`teacher-session-student-group ${tone}`}>
      <div className="teacher-session-student-heading">
        <span>{title}</span>
        <strong>{students.length}</strong>
      </div>

      {students.length ? (
        <ul className="teacher-session-student-list">
          {students.map((student, index) => {
            const studentId = getStudentId(student);
            const rosterStudent = rosterByStudentId.get(studentId);
            const status = normalizeAttendanceStatus(student.status);
            const isPending = pendingStudentId === studentId;
            const studentName =
              student.studentName || rosterStudent?.studentName || student.studentUserId;
            const rollNumber = student.rollNumber || rosterStudent?.rollNumber;

            return (
              <li key={getStudentKey(student, index)} className="teacher-session-student-row">
                <div className="teacher-session-student-profile">
                  <SessionStudentAvatar
                    student={student}
                    rosterStudent={rosterStudent}
                  />
                  <div className="teacher-session-student-details">
                    <strong>{studentName}</strong>
                    <small>
                      {rollNumber
                        ? `Roll ${rollNumber}`
                        : student.studentUserId}
                    </small>
                  </div>
                </div>
                <div className="teacher-session-row-actions">
                  <span className={`teacher-session-status-pill ${tone}`}>
                    {student.statusLabel || formatStatusLabel(student.status)}
                  </span>
                  <div
                    className="teacher-session-edit-toggle"
                    aria-label={`${studentName || studentId} attendance status`}
                  >
                    <button
                      className={
                        status === "present"
                          ? "teacher-session-edit-button present active"
                          : "teacher-session-edit-button present"
                      }
                      type="button"
                      disabled={isPending || status === "present" || !studentId}
                      onClick={() => onStatusChange(sessionId, student, "present")}
                    >
                      Present
                    </button>
                    <button
                      className={
                        status === "absent"
                          ? "teacher-session-edit-button absent active"
                          : "teacher-session-edit-button absent"
                      }
                      type="button"
                      disabled={isPending || status === "absent" || !studentId}
                      onClick={() => onStatusChange(sessionId, student, "absent")}
                    >
                      Absent
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="teacher-session-empty-list">{emptyText}</p>
      )}
    </section>
  );
}

export function TeacherClassroomSessionsPage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const classId = getHashSearchParam("classId");
  const [classroomData, setClassroomData] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [pageStatus, setPageStatus] = useState({
    loading: true,
    message: ""
  });
  const [editStatus, setEditStatus] = useState({
    pendingStudentId: "",
    tone: "",
    message: ""
  });
  const attendanceHistory = classroomData?.attendanceHistory ?? [];
  const rosterByStudentId = useMemo(
    () => buildRosterByStudentId(classroomData?.roster ?? []),
    [classroomData?.roster]
  );
  const selectedSession = useMemo(
    () =>
      attendanceHistory.find(
        (sessionItem) => sessionItem.sessionId === selectedSessionId
      ) ?? null,
    [attendanceHistory, selectedSessionId]
  );
  const selectedSessionGroups = useMemo(
    () => groupSessionStudents(selectedSession),
    [selectedSession]
  );

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

  useEffect(() => {
    if (!attendanceHistory.length) {
      return;
    }

    if (
      !selectedSessionId ||
      !attendanceHistory.some(
        (sessionItem) => sessionItem.sessionId === selectedSessionId
      )
    ) {
      setSelectedSessionId(attendanceHistory[0].sessionId);
    }
  }, [attendanceHistory, selectedSessionId]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
  }

  async function handleSessionStatusChange(sessionId, student, nextStatus) {
    const studentId = getStudentId(student);

    if (!sessionId || !studentId) {
      return;
    }

    setEditStatus({
      pendingStudentId: studentId,
      tone: "",
      message: ""
    });

    try {
      const response = await updateSessionAttendanceRecord(
        user.userId,
        classId,
        sessionId,
        studentId,
        {
          status: nextStatus
        }
      );

      setClassroomData(response.classroomDetails);
      setSelectedSessionId(sessionId);
      setEditStatus({
        pendingStudentId: "",
        tone: "success",
        message: response.message ?? "Attendance record updated."
      });
    } catch (error) {
      setEditStatus({
        pendingStudentId: "",
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update attendance record."
      });
    }
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

  const { classroom } = classroomData;

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
            {classroom.subjectName} • {classroom.subjectCode}
          </p>
        </section>

        <section className="glass-card dashboard-panel teacher-sessions-page-panel">
          {attendanceHistory.length ? (
            <div className="teacher-sessions-layout">
              <div className="teacher-sessions-list">
                {attendanceHistory.map((sessionItem) => {
                  const isSelected = selectedSessionId === sessionItem.sessionId;

                  return (
                    <button
                      key={sessionItem.sessionId}
                      className={`timeline-card teacher-session-card ${
                        isSelected ? "selected" : ""
                      }`}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedSessionId(sessionItem.sessionId)}
                    >
                      <div className="timeline-time">
                        <span>Recorded</span>
                        <strong>{formatDateTime(sessionItem.recordedAt)}</strong>
                      </div>
                      <div className="timeline-content">
                        <strong>
                          {sessionItem.cancelledCount
                            ? `${sessionItem.cancelledCount} cancelled`
                            : `${sessionItem.presentCount} present • ${sessionItem.absentCount} absent`}
                        </strong>
                        <p>
                          {sessionItem.sessionType === "extra"
                            ? "Extra Class"
                            : "Scheduled Class"}{" "}
                          • Unit {sessionItem.attendanceUnit ?? 1}
                        </p>
                      </div>
                      <span className="teacher-session-view-label">View Students</span>
                    </button>
                  );
                })}
              </div>

              <aside className="teacher-session-detail" aria-live="polite">
                {selectedSession ? (
                  <>
                    <div className="teacher-session-detail-header">
                      <div>
                        <span>{formatDateTime(selectedSession.recordedAt)}</span>
                        <strong>
                          {selectedSession.sessionType === "extra"
                            ? "Extra Class"
                            : "Scheduled Class"}
                        </strong>
                      </div>
                      <div className="teacher-session-counts">
                        <span>{selectedSession.presentCount} present</span>
                        <span>{selectedSession.absentCount} absent</span>
                      </div>
                    </div>

                    {selectedSessionGroups.students.length ? (
                      <div className="teacher-session-roster-grid">
                        {editStatus.message ? (
                          <p className={`teacher-status-copy ${editStatus.tone}`}>
                            {editStatus.message}
                          </p>
                        ) : null}
                        <SessionStudentGroup
                          title="Present Students"
                          students={selectedSessionGroups.presentStudents}
                          tone="present"
                          emptyText="No present students in this session."
                          sessionId={selectedSession.sessionId}
                          pendingStudentId={editStatus.pendingStudentId}
                          onStatusChange={handleSessionStatusChange}
                          rosterByStudentId={rosterByStudentId}
                        />
                        <SessionStudentGroup
                          title="Absent Students"
                          students={selectedSessionGroups.absentStudents}
                          tone="absent"
                          emptyText="No absent students in this session."
                          sessionId={selectedSession.sessionId}
                          pendingStudentId={editStatus.pendingStudentId}
                          onStatusChange={handleSessionStatusChange}
                          rosterByStudentId={rosterByStudentId}
                        />
                        {selectedSessionGroups.cancelledStudents.length ? (
                          <SessionStudentGroup
                            title="Cancelled"
                            students={selectedSessionGroups.cancelledStudents}
                            tone="cancelled"
                            emptyText="No cancelled records in this session."
                            sessionId={selectedSession.sessionId}
                            pendingStudentId={editStatus.pendingStudentId}
                            onStatusChange={handleSessionStatusChange}
                            rosterByStudentId={rosterByStudentId}
                          />
                        ) : null}
                      </div>
                    ) : (
                      <p className="panel-fallback">
                        Student names are unavailable for this session.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="panel-fallback">No session selected.</p>
                )}
              </aside>
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
