import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";
import { MetricBar } from "../../../components/common/MetricBar";
import { goToRoute } from "../../../utils/router";

export function StudentClassesPanel({ classes }) {
  return (
    <article className="glass-card dashboard-panel" id="performance">
      <DashboardPanelHeader
        label="Attendance Analytics"
        title="Subject-wise health and next-session impact."
      />

      <div className="course-grid">
        {classes.length ? (
          classes.map((course) => (
            <article key={course.id} className={`course-card ${course.statusTone}`}>
              <div className="course-header">
                <div>
                  <span className="course-code">{course.code}</span>
                  <h3>{course.title}</h3>
                </div>
                <strong>{course.total ? `${course.studentPercentage}%` : "New"}</strong>
              </div>

              <p className="course-meta">
                {course.faculty} • {course.room} • {course.nextClass}
              </p>

              {course.upcomingExam ? (
                <article
                  className={`student-class-exam-note ${course.upcomingExam.eligibility.tone}`}
                >
                  <strong>
                    {course.upcomingExam.examDateLabel} •{" "}
                    {course.upcomingExam.eligibility.statusLabel}
                  </strong>
                  <span>{course.upcomingExam.eligibility.action}</span>
                </article>
              ) : null}

              {course.total > 0 && course.studentPercentage < 75 ? (
                <article className="alert-card warning student-class-warning">
                  <h3>Low attendance warning</h3>
                  <p>
                    Attend {course.classesNeededForSafeRange || 1} upcoming class
                    {(course.classesNeededForSafeRange || 1) === 1 ? "" : "es"} to recover this subject.
                  </p>
                </article>
              ) : null}

              <div className="course-bars">
                <MetricBar label="You" value={course.studentPercentage} tone="student" />
                <MetricBar label="Class Avg" value={course.classAverage} tone="average" />
                <MetricBar label="+ Present" value={course.projectedAfterPresent} tone="friends" />
                <MetricBar label="+ Absent" value={course.projectedAfterAbsent} tone="average" />
              </div>

              <div className="student-course-status-grid">
                <div>
                  <span>Status</span>
                  <strong>{course.statusLabel}</strong>
                </div>
                <div>
                  <span>Recovery</span>
                  <strong>
                    {course.classesNeededForSafeRange
                      ? `${course.classesNeededForSafeRange} classes`
                      : "Safe"}
                  </strong>
                </div>
                <div>
                  <span>Absent</span>
                  <strong>{course.absent ?? Math.max(0, course.total - course.attended)}</strong>
                </div>
              </div>

              <div className="course-footer">
                <span>
                  {course.attended}/{course.total} sessions attended
                </span>
                <span>
                  Last: {course.lastStatus} • {course.lastMarkedLabel}
                </span>
              </div>
              <div className="course-action-row">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() =>
                    goToRoute(
                      `/student-classroom?classId=${encodeURIComponent(course.id)}`
                    )
                  }
                >
                  Open Class Analytics
                </button>
                <span className={`course-status-badge ${course.statusTone}`}>
                  {course.statusLabel}
                </span>
              </div>
            </article>
          ))
        ) : (
          <p className="panel-fallback">
            Join at least one class to start seeing class-wise attendance here.
          </p>
        )}
      </div>
    </article>
  );
}
