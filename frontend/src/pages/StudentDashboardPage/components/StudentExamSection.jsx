import { useEffect, useMemo, useState } from "react";
import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";
import { ExamCalendar } from "../../../components/common/ExamCalendar";

const scheduleDayIndexes = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

function getExamToneClass(tone) {
  if (tone === "positive") {
    return "positive";
  }

  if (tone === "danger") {
    return "danger";
  }

  return "warning";
}

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStartOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);

  return date;
}

function timeToMinutes(value) {
  const [hour, minute] = String(value ?? "00:00")
    .split(":")
    .map(Number);

  return hour * 60 + minute;
}

function countScheduledClassesBeforeExam(scheduleSlots = [], examDateValue) {
  const examDate = getStartOfDay(examDateValue);

  if (!Number.isFinite(examDate.getTime())) {
    return 0;
  }

  const now = new Date();
  const cursor = getStartOfDay(now);
  const todayKey = getTodayKey();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let count = 0;

  while (cursor < examDate) {
    const cursorKey = [
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, "0"),
      String(cursor.getDate()).padStart(2, "0")
    ].join("-");

    scheduleSlots
      .filter((slot) => scheduleDayIndexes[slot.day] === cursor.getDay())
      .forEach((slot) => {
        if (cursorKey !== todayKey || timeToMinutes(slot.startTime) > nowMinutes) {
          count += 1;
        }
      });

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function clampNumber(value, min, max) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.max(min, Math.min(max, numericValue));
}

function getInitialCalculatorDraft(classes) {
  const firstClass = classes[0];

  return {
    classId: firstClass?.id ?? "",
    examDate: "",
    currentPercentage: firstClass?.studentPercentage ?? 0,
    requiredPercentage: firstClass?.upcomingExam?.requiredAttendancePercentage ?? 75
  };
}

export function StudentAttendanceCalculator({ classes = [] }) {
  const [draft, setDraft] = useState(() => getInitialCalculatorDraft(classes));
  const selectedClass = useMemo(
    () => classes.find((course) => course.id === draft.classId) ?? classes[0] ?? null,
    [classes, draft.classId]
  );
  const totalHeld = selectedClass?.total ?? 0;
  const currentPercentage = clampNumber(draft.currentPercentage, 0, 100);
  const requiredPercentage = clampNumber(draft.requiredPercentage, 0, 100);
  const classesBeforeExam = selectedClass
    ? countScheduledClassesBeforeExam(selectedClass.scheduleSlots ?? [], draft.examDate)
    : 0;
  const attendedEstimate = totalHeld
    ? (currentPercentage / 100) * totalHeld
    : selectedClass?.attended ?? 0;
  const projectedTotal = totalHeld + classesBeforeExam;
  const minimumClassesToAttend = projectedTotal
    ? Math.max(
        0,
        Math.ceil((requiredPercentage / 100) * projectedTotal - attendedEstimate)
      )
    : 0;
  const canQualify = minimumClassesToAttend <= classesBeforeExam;
  const projectedIfAttendAll = projectedTotal
    ? Math.round(
        ((attendedEstimate + classesBeforeExam) / projectedTotal) * 100
      )
    : 0;
  const hasExamDate = Boolean(draft.examDate);
  const resultTone = !hasExamDate || !projectedTotal
    ? "warning"
    : minimumClassesToAttend <= 0
      ? "positive"
      : canQualify
        ? "warning"
        : "danger";
  const resultMessage = !hasExamDate
    ? "Pick an exam date to calculate your attendance plan."
    : !projectedTotal
      ? "No recorded or scheduled classes were found before that date."
    : minimumClassesToAttend <= 0
      ? `You are already above ${requiredPercentage}% for this exam plan.`
      : canQualify
        ? `Attend at least ${minimumClassesToAttend} of the next ${classesBeforeExam} scheduled class${classesBeforeExam === 1 ? "" : "es"} to be safe.`
        : classesBeforeExam
          ? `Even attending all ${classesBeforeExam} scheduled class${classesBeforeExam === 1 ? "" : "es"} may not reach ${requiredPercentage}%. Ask your teacher for guidance.`
          : "No scheduled class remains before that date.";

  useEffect(() => {
    if (!classes.length) {
      return;
    }

    setDraft((currentDraft) => {
      const nextClass =
        classes.find((course) => course.id === currentDraft.classId) ?? classes[0];

      return {
        ...currentDraft,
        classId: nextClass.id,
        currentPercentage: nextClass.studentPercentage ?? 0,
        requiredPercentage:
          nextClass.upcomingExam?.requiredAttendancePercentage ??
          currentDraft.requiredPercentage
      };
    });
  }, [classes]);

  function updateDraft(field, value) {
    setDraft((currentDraft) => {
      if (field !== "classId") {
        return {
          ...currentDraft,
          [field]: value
        };
      }

      const nextClass = classes.find((course) => course.id === value);

      return {
        ...currentDraft,
        classId: value,
        currentPercentage: nextClass?.studentPercentage ?? 0,
        requiredPercentage:
          nextClass?.upcomingExam?.requiredAttendancePercentage ??
          currentDraft.requiredPercentage
      };
    });
  }

  return (
    <article className="glass-card dashboard-panel student-attendance-calculator">
      <DashboardPanelHeader
        label="Attendance Calculator"
        title="Check a custom exam date before your teacher sets it."
      />

      {classes.length ? (
        <>
          <div className="student-calculator-form">
            <label className="field">
              <span>Class</span>
              <select
                value={draft.classId}
                onChange={(event) => updateDraft("classId", event.target.value)}
              >
                {classes.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} - {course.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Current Attendance</span>
              <input
                type="number"
                min="0"
                max="100"
                value={draft.currentPercentage}
                onChange={(event) =>
                  updateDraft("currentPercentage", event.target.value)
                }
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

            <label className="field">
              <span>Required Eligibility</span>
              <input
                type="number"
                min="0"
                max="100"
                value={draft.requiredPercentage}
                onChange={(event) =>
                  updateDraft("requiredPercentage", event.target.value)
                }
              />
            </label>
          </div>

          <article className={`student-calculator-result ${resultTone}`}>
            <div>
              <span>Must Attend</span>
              <strong>{minimumClassesToAttend}</strong>
            </div>
            <p>{resultMessage}</p>
          </article>

          <div className="student-calculator-metrics">
            <div>
              <span>Classes Held</span>
              <strong>{totalHeld}</strong>
            </div>
            <div>
              <span>From Schedule</span>
              <strong>{classesBeforeExam}</strong>
            </div>
            <div>
              <span>Required</span>
              <strong>{requiredPercentage}%</strong>
            </div>
            <div>
              <span>If Attend All</span>
              <strong>{projectedIfAttendAll}%</strong>
            </div>
          </div>
        </>
      ) : (
        <p className="panel-fallback">
          Join a classroom first to calculate exam attendance eligibility.
        </p>
      )}
    </article>
  );
}

export function StudentExamCalendarPanel({ upcomingExams = [], classes = [] }) {
  return (
    <section className="student-calendar-page-grid" id="calendar">
      <article className="glass-card dashboard-panel student-calendar-full-panel">
        <DashboardPanelHeader
          label="Calendar"
          title="Exam dates and regular class schedule."
        />

        <ExamCalendar exams={upcomingExams} classes={classes} />
      </article>
    </section>
  );
}

export function StudentUpcomingExamEligibilityPanel({ upcomingExams = [] }) {
  const priorityExam = upcomingExams.find(
    (exam) => exam.eligibility?.tone !== "positive"
  ) ?? upcomingExams[0] ?? null;

  return (
    <section className="dashboard-lower-grid" id="exams">
      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Upcoming Exams & Eligibility"
          title="Minimum classes to attend before each exam."
        />

        {priorityExam ? (
          <article
            className={`student-exam-alert ${getExamToneClass(
              priorityExam.eligibility.tone
            )}`}
          >
            <span>{priorityExam.subjectCode}</span>
            <h3>{priorityExam.eligibility.statusLabel}</h3>
            <p>{priorityExam.eligibility.action}</p>
          </article>
        ) : null}

        <div className="student-exam-list">
          {upcomingExams.length ? (
            upcomingExams.map((exam) => (
              <article
                key={exam.id}
                className={`student-exam-card ${getExamToneClass(
                  exam.eligibility.tone
                )}`}
              >
                <div className="student-exam-card-header">
                  <div>
                    <span>{exam.subjectCode}</span>
                    <h3>{exam.title}</h3>
                  </div>
                  <strong>{exam.examDateLabel}</strong>
                </div>

                <div className="student-exam-metrics">
                  <div>
                    <span>Required</span>
                    <strong>{exam.requiredAttendancePercentage}%</strong>
                  </div>
                  <div>
                    <span>Current</span>
                    <strong>{exam.eligibility.currentPercentage}%</strong>
                  </div>
                  <div>
                    <span>Classes Before Exam</span>
                    <strong>{exam.eligibility.classesBeforeExam}</strong>
                  </div>
                  <div>
                    <span>Must Attend</span>
                    <strong>{exam.eligibility.minimumClassesToAttend}</strong>
                  </div>
                </div>

                <p>{exam.eligibility.action}</p>
              </article>
            ))
          ) : (
            <p className="panel-fallback">
              Exam eligibility will appear when your teachers set exam dates.
            </p>
          )}
        </div>
      </article>
    </section>
  );
}
