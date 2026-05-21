import { useEffect, useMemo, useRef, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  fetchTeacherClassroom,
  sendExamAttendanceWarningEmails,
  setTeacherClassExam
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { getHashSearchParam, goToRoute } from "../../utils/router";
import "../TeacherDashboardPage/TeacherDashboardPage.css";
import "../TeacherClassroomPage/TeacherClassroomPage.css";

function getTodayKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getExamDraftFromClassroom(classroom = {}) {
  const upcomingExam = classroom.upcomingExam;

  return {
    title: upcomingExam?.title ?? (classroom.subjectCode ? `${classroom.subjectCode} Exam` : ""),
    examDate: upcomingExam?.examDateKey ?? "",
    requiredAttendancePercentage: upcomingExam?.requiredAttendancePercentage ?? 75,
    note: upcomingExam?.note ?? ""
  };
}

function summarizeExamWarningNotifications(notifications) {
  if (
    notifications &&
    !Array.isArray(notifications) &&
    notifications.status === "failed"
  ) {
    return `Exam email workflow failed: ${notifications.reason || "unknown error"}.`;
  }

  if (!Array.isArray(notifications) || notifications.length === 0) {
    return "No low-attendance exam email was needed.";
  }

  const sentCount = notifications.filter((item) => item.status === "sent").length;
  const failedCount = notifications.filter((item) => item.status === "failed").length;
  const skippedCount = notifications.filter((item) => item.status === "skipped").length;
  const duplicateCount = notifications.filter(
    (item) => item.reason === "duplicate" || item.reason === "duplicate-in-flight"
  ).length;

  if (failedCount) {
    return `${sentCount} exam email(s) sent, ${failedCount} failed, and ${skippedCount} skipped.`;
  }

  if (sentCount) {
    return `${sentCount} low-attendance exam email(s) sent.`;
  }

  if (duplicateCount === skippedCount) {
    return "Low-attendance exam emails were already sent for the current attendance percentage.";
  }

  return `${skippedCount} low-attendance exam email notice(s) were skipped.`;
}

export function TeacherClassExamPage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const classId = getHashSearchParam("classId");
  const [classroomData, setClassroomData] = useState(null);
  const [examDraft, setExamDraft] = useState(getExamDraftFromClassroom());
  const [status, setStatus] = useState({
    loading: true,
    message: ""
  });
  const [examStatus, setExamStatus] = useState({
    pending: false,
    tone: "",
    message: ""
  });
  const [examEmailStatus, setExamEmailStatus] = useState({
    pending: false,
    tone: "",
    message: ""
  });
  const examEmailRequestRef = useRef(false);

  async function loadClassroom(activeUser = user) {
    if (!activeUser || activeUser.role !== "teacher") {
      return;
    }

    if (!classId) {
      setStatus({
        loading: false,
        message: "Choose a class before opening exam setup."
      });
      return;
    }

    try {
      const response = await fetchTeacherClassroom(activeUser.userId, classId);
      setClassroomData(response);
      setExamDraft(getExamDraftFromClassroom(response.classroom));
      setStatus({
        loading: false,
        message: ""
      });
    } catch (error) {
      setStatus({
        loading: false,
        message:
          error instanceof Error ? error.message : "Unable to load exam setup."
      });
    }
  }

  useEffect(() => {
    if (!user || user.role !== "teacher") {
      goToRoute("/login");
      return;
    }

    void loadClassroom();
  }, [user, classId]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
  }

  function updateExamDraft(field, value) {
    setExamDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!examDraft.examDate) {
      setExamStatus({
        pending: false,
        tone: "warning",
        message: "Choose an exam date."
      });
      return;
    }

    setExamStatus({
      pending: true,
      tone: "",
      message: "Saving exam schedule..."
    });

    try {
      const response = await setTeacherClassExam(user.userId, classId, {
        title: examDraft.title,
        examDate: examDraft.examDate,
        requiredAttendancePercentage: examDraft.requiredAttendancePercentage,
        note: examDraft.note
      });
      const updatedClassroom = await fetchTeacherClassroom(user.userId, classId);

      setClassroomData(updatedClassroom);
      setExamDraft(getExamDraftFromClassroom(updatedClassroom.classroom));
      setExamStatus({
        pending: false,
        tone: "positive",
        message: `${response.message ?? "Exam schedule saved."} Emails were not sent.`
      });
      setExamEmailStatus({
        pending: false,
        tone: "",
        message: ""
      });
    } catch (error) {
      setExamStatus({
        pending: false,
        tone: "warning",
        message:
          error instanceof Error ? error.message : "Unable to save exam schedule."
      });
    }
  }

  async function handleSendExamEmails() {
    if (examEmailRequestRef.current) {
      return;
    }

    if (!classroomData?.classroom?.upcomingExam) {
      setExamEmailStatus({
        pending: false,
        tone: "warning",
        message: "Save an exam schedule before sending emails."
      });
      return;
    }

    examEmailRequestRef.current = true;
    setExamEmailStatus({
      pending: true,
      tone: "",
      message: "Sending low-attendance exam emails..."
    });

    try {
      const response = await sendExamAttendanceWarningEmails(user.userId, classId);

      if (response.classroomDetails) {
        setClassroomData(response.classroomDetails);
      }
      setExamEmailStatus({
        pending: false,
        tone: "positive",
        message: summarizeExamWarningNotifications(
          response.emailStatus?.examWarnings
        )
      });
    } catch (error) {
      setExamEmailStatus({
        pending: false,
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Unable to send low-attendance exam emails."
      });
    } finally {
      examEmailRequestRef.current = false;
    }
  }

  const classroom = classroomData?.classroom ?? null;
  const backToClassRoute = classId
    ? `/teacher-classroom?classId=${encodeURIComponent(classId)}`
    : "/teacher-classes";

  if (!user || user.role !== "teacher") {
    return null;
  }

  if (status.loading) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard label="Loading" title="Preparing exam setup..." />
        </main>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard
            label="Exam Setup"
            title={status.message || "Unable to load this class."}
            action={
              <button
                className="secondary-button"
                type="button"
                onClick={() => goToRoute("/teacher-classes")}
              >
                Back to Classes
              </button>
            }
          />
        </main>
      </div>
    );
  }

  const isArchived = classroom.status === "archived";

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="dashboard-topbar glass-card">
        <AppBrand href="#/" subtitle="Teacher Exam Setup" />

        <nav className="dashboard-nav">
          <button
            className="dashboard-nav-button"
            type="button"
            onClick={() => goToRoute("/teacher-dashboard")}
          >
            Dashboard
          </button>
          <button
            className="dashboard-nav-button"
            type="button"
            onClick={() => goToRoute("/teacher-classes")}
          >
            Classes
          </button>
          <button className="dashboard-nav-button active-teacher-nav" type="button">
            Exam Setup
          </button>
        </nav>

        <div className="dashboard-header-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => goToRoute(backToClassRoute)}
          >
            Back to Class
          </button>
          <button className="primary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-shell">
        <section className="glass-card dashboard-panel classroom-exam-setup-panel">
          <div>
            <span className="pill">Exam Setup</span>
            <h2>{classroom.upcomingExam ? "Update class exam" : "Set class exam"}</h2>
            <p>
              {classroom.subjectCode} • {classroom.section || "Section pending"} •{" "}
              {classroom.room || "Room pending"}
            </p>
            {classroom.upcomingExam ? (
              <p>
                Current: {classroom.upcomingExam.examDateLabel} • Required{" "}
                {classroom.upcomingExam.requiredAttendancePercentage}%
              </p>
            ) : null}
          </div>

          <form className="teacher-exam-form classroom-exam-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Exam Title</span>
              <input
                type="text"
                value={examDraft.title}
                maxLength={80}
                onChange={(event) => updateExamDraft("title", event.target.value)}
                placeholder={`${classroom.subjectCode} Exam`}
                disabled={isArchived || examStatus.pending}
              />
            </label>

            <div className="teacher-exam-field-grid">
              <label className="field">
                <span>Exam Date</span>
                <input
                  type="date"
                  min={getTodayKey()}
                  value={examDraft.examDate}
                  onChange={(event) => updateExamDraft("examDate", event.target.value)}
                  disabled={isArchived || examStatus.pending}
                />
              </label>
              <label className="field">
                <span>Required Attendance</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={examDraft.requiredAttendancePercentage}
                  onChange={(event) =>
                    updateExamDraft("requiredAttendancePercentage", event.target.value)
                  }
                  disabled={isArchived || examStatus.pending}
                />
              </label>
            </div>

            <label className="field">
              <span>Note</span>
              <textarea
                value={examDraft.note}
                maxLength={220}
                rows={3}
                onChange={(event) => updateExamDraft("note", event.target.value)}
                placeholder="Internal test, midterm, final exam..."
                disabled={isArchived || examStatus.pending}
              />
            </label>

            <div className="teacher-exam-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={isArchived || examStatus.pending || !examDraft.examDate}
              >
                {examStatus.pending ? "Saving..." : "Save Exam"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={
                  isArchived ||
                  examStatus.pending ||
                  examEmailStatus.pending ||
                  !classroom.upcomingExam
                }
                onClick={handleSendExamEmails}
              >
                {examEmailStatus.pending ? "Sending..." : "Send Email"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => goToRoute(backToClassRoute)}
              >
                Open Class
              </button>
              {examStatus.message ? (
                <span className={`teacher-exam-status ${examStatus.tone}`}>
                  {examStatus.message}
                </span>
              ) : null}
              {examEmailStatus.message ? (
                <span className={`teacher-exam-status ${examEmailStatus.tone}`}>
                  {examEmailStatus.message}
                </span>
              ) : null}
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
