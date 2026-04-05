import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";
import { MetricBar } from "../../../components/common/MetricBar";

export function StudentClassesPanel({ classes }) {
  return (
    <article className="glass-card dashboard-panel" id="performance">
      <DashboardPanelHeader
        label="Joined Classes"
        title="Class-wise attendance and competitiveness."
      />

      <div className="course-grid">
        {classes.length ? (
          classes.map((course) => (
            <article key={course.code} className="course-card">
              <div className="course-header">
                <div>
                  <span className="course-code">{course.code}</span>
                  <h3>{course.title}</h3>
                </div>
                <strong>{course.studentPercentage}%</strong>
              </div>

              <p className="course-meta">
                {course.faculty} • {course.room} • {course.nextClass}
              </p>

              <div className="course-bars">
                <MetricBar label="You" value={course.studentPercentage} tone="student" />
                <MetricBar label="Class Avg" value={course.classAverage} tone="average" />
                <MetricBar label="Friends" value={course.friendAverage} tone="friends" />
              </div>

              <div className="course-footer">
                <span>
                  {course.attended}/{course.total} sessions attended
                </span>
                <span>
                  {course.studentPercentage >= course.classAverage
                    ? "Above class pace"
                    : "Needs recovery"}
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
