import { useEffect, useMemo, useState } from "react";
import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";
import { ExamCalendar } from "../../../components/common/ExamCalendar";

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getInitialDraft(classesManaged) {
  const firstClass = classesManaged[0];

  return {
    classId: firstClass?.id ?? "",
    title: firstClass ? `${firstClass.code} Exam` : "",
    examDate: "",
    requiredAttendancePercentage: 75,
    note: ""
  };
}

export function TeacherExamsSection({
  classesManaged,
  upcomingExams,
  onSetExam
}) {
  const [draft, setDraft] = useState(() => getInitialDraft(classesManaged));
  const [status, setStatus] = useState({
    tone: "",
    message: ""
  });
  const selectedClass = useMemo(
    () => classesManaged.find((course) => course.id === draft.classId) ?? null,
    [classesManaged, draft.classId]
  );

  useEffect(() => {
    if (!classesManaged.length) {
      return;
    }

    setDraft((currentDraft) => {
      const currentClass =
        classesManaged.find((course) => course.id === currentDraft.classId) ??
        classesManaged[0];
      const existingExam = currentClass.upcomingExam;

      return {
        classId: currentClass.id,
        title: existingExam?.title ?? currentDraft.title ?? `${currentClass.code} Exam`,
        examDate: existingExam?.examDateKey ?? currentDraft.examDate,
        requiredAttendancePercentage:
          existingExam?.requiredAttendancePercentage ??
          currentDraft.requiredAttendancePercentage,
        note: existingExam?.note ?? currentDraft.note
      };
    });
  }, [classesManaged]);

  function updateDraft(field, value) {
    setDraft((currentDraft) => {
      if (field !== "classId") {
        return {
          ...currentDraft,
          [field]: value
        };
      }

      const nextClass = classesManaged.find((course) => course.id === value);
      const existingExam = nextClass?.upcomingExam;

      return {
        classId: value,
        title: existingExam?.title ?? (nextClass ? `${nextClass.code} Exam` : ""),
        examDate: existingExam?.examDateKey ?? "",
        requiredAttendancePercentage:
          existingExam?.requiredAttendancePercentage ?? 75,
        note: existingExam?.note ?? ""
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!draft.classId || !draft.examDate) {
      setStatus({
        tone: "warning",
        message: "Choose a class and exam date."
      });
      return;
    }

    setStatus({
      tone: "loading",
      message: "Saving exam schedule..."
    });

    try {
      await onSetExam(draft.classId, {
        title: draft.title,
        examDate: draft.examDate,
        requiredAttendancePercentage: draft.requiredAttendancePercentage,
        note: draft.note
      });
      setStatus({
        tone: "positive",
        message: "Exam schedule saved."
      });
    } catch (error) {
      setStatus({
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save exam schedule."
      });
    }
  }

  return (
    <section className="dashboard-lower-grid" id="exams">
      <article className="glass-card dashboard-panel teacher-exam-form-panel">
        <DashboardPanelHeader
          label="Exam Setup"
          title="Set the next exam and eligibility percentage."
        />

        <form className="teacher-exam-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Class</span>
            <select
              value={draft.classId}
              onChange={(event) => updateDraft("classId", event.target.value)}
            >
              {classesManaged.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} • {course.section || "Section TBD"}
                </option>
              ))}
            </select>
          </label>

          <div className="teacher-exam-field-grid">
            <label className="field">
              <span>Exam Title</span>
              <input
                type="text"
                value={draft.title}
                maxLength={80}
                onChange={(event) => updateDraft("title", event.target.value)}
                placeholder={selectedClass ? `${selectedClass.code} Exam` : "Exam"}
              />
            </label>

            <label className="field">
              <span>Exam Date</span>
              <input
                type="date"
                min={getTodayKey()}
                value={draft.examDate}
                onChange={(event) => updateDraft("examDate", event.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span>Required Attendance</span>
            <input
              type="number"
              min="0"
              max="100"
              value={draft.requiredAttendancePercentage}
              onChange={(event) =>
                updateDraft("requiredAttendancePercentage", event.target.value)
              }
            />
          </label>

          <label className="field">
            <span>Note</span>
            <textarea
              value={draft.note}
              maxLength={220}
              rows={3}
              onChange={(event) => updateDraft("note", event.target.value)}
              placeholder="Internal test, midterm, final exam..."
            />
          </label>

          <div className="teacher-exam-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={!classesManaged.length || status.tone === "loading"}
            >
              {status.tone === "loading" ? "Saving..." : "Save Exam"}
            </button>
            {status.message ? (
              <span className={`teacher-exam-status ${status.tone}`}>
                {status.message}
              </span>
            ) : null}
          </div>
        </form>
      </article>

      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Upcoming Exams"
          title="Calendar and eligibility readiness."
        />

        <ExamCalendar exams={upcomingExams} />

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
