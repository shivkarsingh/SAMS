import { useState } from "react";

export function TeacherClassesPanel({
  classesManaged,
  onOpenClassroom,
  onOpenAttendance,
  onArchiveClass
}) {
  const classCount = classesManaged.length;
  const [copiedClassId, setCopiedClassId] = useState("");
  const [archiveStatus, setArchiveStatus] = useState({
    pendingId: "",
    message: ""
  });

  async function copyJoinCode(course) {
    try {
      await navigator.clipboard.writeText(course.joinCode);
      setCopiedClassId(course.id);
      window.setTimeout(() => setCopiedClassId(""), 1600);
    } catch {
      setCopiedClassId("");
    }
  }

  async function handleArchiveClass(course) {
    const confirmed = window.confirm(
      `End ${course.code} - ${course.title}? The class will become inactive, but the attendance and student data will stay saved.`
    );

    if (!confirmed) {
      return;
    }

    setArchiveStatus({ pendingId: course.id, message: "" });

    try {
      const result = await onArchiveClass(course.id);
      setArchiveStatus({
        pendingId: "",
        message: result.message ?? "Class ended and saved."
      });
    } catch (error) {
      setArchiveStatus({
        pendingId: "",
        message:
          error instanceof Error ? error.message : "Unable to end this class."
      });
    }
  }

  return (
    <article className="glass-card dashboard-panel" id="classes">
      <div className="dashboard-panel-header teacher-managed-header">
        <div>
          <span className="pill">Classes</span>
          <h2>Class sections</h2>
        </div>
        <div className="teacher-class-counter" aria-label={`${classCount} classes`}>
          <strong>{classCount}</strong>
          <span>{classCount === 1 ? "Class" : "Classes"}</span>
        </div>
      </div>

      <div className="teacher-class-grid">
        {archiveStatus.message ? (
          <p className="teacher-status-copy success">{archiveStatus.message}</p>
        ) : null}

        {classesManaged.length ? (
          classesManaged.map((course) => (
            <article key={course.id} className="teacher-class-card">
              <div className="teacher-class-header">
                <div>
                  <span className="course-code">{course.code}</span>
                  <h3>{course.title}</h3>
                </div>
                <span
                  className={`teacher-status-pill ${
                    course.status === "archived"
                      ? "archived"
                      : course.attendanceSubmitted
                        ? "submitted"
                        : "pending"
                  }`}
                >
                  {course.status === "archived"
                    ? "Inactive"
                    : course.attendanceSubmitted
                      ? "Sessions Recorded"
                      : "No Sessions Yet"}
                </span>
              </div>

              <p className="course-meta">
                {course.section} • {course.room} • {course.nextClass}
              </p>

              {course.status === "archived" && course.archiveSummary ? (
                <p className="teacher-archive-mini">
                  Saved summary: {course.archiveSummary.totalSessions} classes held •{" "}
                  {course.archiveSummary.averageAttendance}% average attendance •{" "}
                  {course.archiveSummary.studentsCount} students
                </p>
              ) : null}

              {course.upcomingExam ? (
                <p className="teacher-exam-mini">
                  Exam: {course.upcomingExam.examDateLabel} • Required{" "}
                  {course.upcomingExam.requiredAttendancePercentage}% •{" "}
                  {course.upcomingExam.eligibility.atRiskStudents} at risk
                </p>
              ) : null}

              <div className="teacher-class-metrics">
                <div>
                  <span>Students</span>
                  <strong>{course.studentsCount}</strong>
                </div>
                <div>
                  <span>Classes Held</span>
                  <strong>{course.totalSessions}</strong>
                </div>
                <div>
                  <span>Join Code</span>
                  <div className="teacher-join-code-row">
                    <strong>{course.joinCode}</strong>
                    <button
                      type="button"
                      onClick={() => copyJoinCode(course)}
                    >
                      {copiedClassId === course.id ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="teacher-class-actions" style={{ marginTop: "16px" }}>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => onOpenClassroom(course.id)}
                >
                  Open Class
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={course.status === "archived"}
                  onClick={() => onOpenAttendance(course.id)}
                >
                  {course.status === "archived" ? "Inactive" : "Take Attendance"}
                </button>
                {course.status !== "archived" ? (
                  <button
                    className="danger-button"
                    type="button"
                    disabled={archiveStatus.pendingId === course.id}
                    onClick={() => handleArchiveClass(course)}
                  >
                    {archiveStatus.pendingId === course.id ? "Ending..." : "End Class"}
                  </button>
                ) : null}
                <span className="panel-meta">
                  {course.status === "archived"
                    ? "This class is inactive. Its overall data remains saved for records."
                    : "Open the class or jump straight to manual and camera attendance."}
                </span>
              </div>
            </article>
          ))
        ) : (
          <p className="panel-fallback">
            Create your first class to start managing rosters and attendance here.
          </p>
        )}
      </div>
    </article>
  );
}
