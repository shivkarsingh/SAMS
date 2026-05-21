import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";
import { ExamCalendar } from "../../../components/common/ExamCalendar";

export function TeacherExamsSection({ upcomingExams, classesManaged = [] }) {
  return (
    <section className="dashboard-lower-grid" id="exams">
      <article className="glass-card dashboard-panel teacher-exam-overview-panel">
        <DashboardPanelHeader
          label="Calendar"
          title=""
        />

        <ExamCalendar
          exams={upcomingExams}
          classes={classesManaged}
          showClassAttendanceStatus
          startOnCurrentMonth
        />

        <div className="teacher-exam-list">
          {upcomingExams.length ? (
            upcomingExams.map((exam) => (
              <article key={exam.id} className="teacher-exam-card">
                <div className="teacher-exam-card-header">
                  <div>
                    <span>{exam.subjectCode}</span>
                    <h3>{exam.title}</h3>
                  </div>
                  <strong>{exam.examDateLabel}</strong>
                </div>

                <div className="teacher-exam-metrics">
                  <div>
                    <span>Required</span>
                    <strong>{exam.requiredAttendancePercentage}%</strong>
                  </div>
                  <div>
                    <span>Classes Before Exam</span>
                    <strong>{exam.classesBeforeExam}</strong>
                  </div>
                  <div>
                    <span>Eligible</span>
                    <strong>{exam.eligibility.eligibleStudents}</strong>
                  </div>
                  <div>
                    <span>At Risk</span>
                    <strong>{exam.eligibility.atRiskStudents}</strong>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="panel-fallback">
              Saved exams will appear here after you set an exam date.
            </p>
          )}
        </div>
      </article>
    </section>
  );
}
