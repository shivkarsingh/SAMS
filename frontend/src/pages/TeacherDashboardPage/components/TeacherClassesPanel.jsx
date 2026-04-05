import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";

export function TeacherClassesPanel({ classesManaged, onOpenClassroom }) {
  return (
    <article className="glass-card dashboard-panel" id="classes">
      <DashboardPanelHeader
        label="Managed Classes"
        title="Track every section you teach."
      />

      <div className="teacher-class-grid">
        {classesManaged.length ? (
          classesManaged.map((course) => (
            <article key={`${course.code}-${course.section}`} className="teacher-class-card">
              <div className="teacher-class-header">
                <div>
                  <span className="course-code">{course.code}</span>
                  <h3>{course.title}</h3>
                </div>
                <span
                  className={`teacher-status-pill ${
                    course.attendanceSubmitted ? "submitted" : "pending"
                  }`}
                >
                  {course.attendanceSubmitted ? "Sessions Recorded" : "No Sessions Yet"}
                </span>
              </div>

              <p className="course-meta">
                {course.section} • {course.room} • {course.nextClass}
              </p>

              <div className="teacher-class-metrics">
                <div>
                  <span>Students</span>
                  <strong>{course.studentsCount}</strong>
                </div>
                <div>
                  <span>Average Attendance</span>
                  <strong>{course.averageAttendance}%</strong>
                </div>
                <div>
                  <span>Flagged Students</span>
                  <strong>{course.flaggedStudents}</strong>
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
                <span className="panel-meta">
                  Review the roster and submit attendance from the class workspace.
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
