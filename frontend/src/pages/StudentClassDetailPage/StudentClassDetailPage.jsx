import { useEffect, useMemo, useState } from "react";
import { DashboardPanelHeader } from "../../components/common/DashboardPanelHeader";
import { LoadingCard } from "../../components/common/LoadingCard";
import { MetricBar } from "../../components/common/MetricBar";
import { PageBackground } from "../../components/common/PageBackground";
import {
  fetchStudentDashboard,
  submitStudentLeaveRequest
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { getHashSearchParam, goToRoute } from "../../utils/router";
import { StudentDashboardHeader } from "../StudentDashboardPage/components/StudentDashboardHeader";
import { readStoredStudentProfile } from "../StudentDashboardPage/studentProfileStore";
import "../StudentDashboardPage/StudentDashboardPage.css";
import "../StudentDashboardPage/components/StudentClassroomSection.css";
import "./StudentClassDetailPage.css";

const classDetailNavItems = [
  { id: "overview", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "leave", label: "Leave" },
  { id: "history", label: "History" },
  { id: "schedule", label: "Schedule" }
];
const MAX_LEAVE_FILES = 4;
const MAX_LEAVE_FILE_BYTES = 2.5 * 1024 * 1024;
const allowedLeaveFileTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);
const initialLeaveDraft = {
  requestType: "medical",
  absenceDate: "",
  reason: "",
  files: []
};

function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);

  if (section) {
    section.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function formatConfidence(confidence) {
  const numericConfidence = Number(confidence);

  if (!Number.isFinite(numericConfidence)) {
    return "";
  }

  return `${Math.round(Math.max(0, Math.min(1, numericConfidence)) * 100)}% confidence`;
}

function formatMethod(method) {
  return String(method ?? "manual")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateLabel(value) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function formatFileSize(size) {
  if (!size) {
    return "0 B";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function validateLeaveFiles(files) {
  const selectedFiles = Array.from(files ?? []);
  const acceptedFiles = selectedFiles
    .filter(
      (file) =>
        allowedLeaveFileTypes.has(file.type) &&
        file.size > 0 &&
        file.size <= MAX_LEAVE_FILE_BYTES
    )
    .slice(0, MAX_LEAVE_FILES);

  if (selectedFiles.length > MAX_LEAVE_FILES) {
    return {
      files: acceptedFiles,
      message: `Use up to ${MAX_LEAVE_FILES} proof documents.`
    };
  }

  if (selectedFiles.some((file) => !allowedLeaveFileTypes.has(file.type))) {
    return {
      files: acceptedFiles,
      message: "Only PDF and image proof documents are allowed."
    };
  }

  if (selectedFiles.some((file) => file.size > MAX_LEAVE_FILE_BYTES)) {
    return {
      files: acceptedFiles,
      message: `Each proof document must be ${formatFileSize(MAX_LEAVE_FILE_BYTES)} or smaller.`
    };
  }

  return {
    files: acceptedFiles,
    message: ""
  };
}

function convertFilesToAttachments(files) {
  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            resolve({
              fileName: file.name,
              fileType: file.type || "application/octet-stream",
              fileSize: file.size,
              dataUrl: String(reader.result ?? "")
            });
          };
          reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
          reader.readAsDataURL(file);
        })
    )
  );
}

function ProofPreview({ attachment }) {
  const isImage = String(attachment.fileType ?? "").startsWith("image/");
  const isPdf = attachment.fileType === "application/pdf";

  return (
    <article className="leave-proof-preview">
      <div className="leave-proof-preview-head">
        <strong>{attachment.fileName}</strong>
        <span>{formatFileSize(attachment.fileSize)}</span>
      </div>
      {isImage ? (
        <img src={attachment.dataUrl} alt={attachment.fileName} />
      ) : isPdf ? (
        <iframe title={attachment.fileName} src={attachment.dataUrl} />
      ) : (
        <p className="panel-fallback">Preview is not available for this file.</p>
      )}
    </article>
  );
}

function LeaveRequestCard({ request }) {
  return (
    <article className={`student-leave-request-card ${request.status}`}>
      <div className="student-leave-request-head">
        <div>
          <strong>{formatDateLabel(request.absenceDate)}</strong>
          <span>
            {request.requestType} • Submitted {formatDateLabel(request.submittedAt)}
          </span>
        </div>
        <span className={`leave-status-pill ${request.status}`}>
          {request.status}
        </span>
      </div>
      <p>{request.reason}</p>
      {request.teacherNote ? (
        <div className="student-leave-teacher-note">
          <strong>Teacher note</strong>
          <span>{request.teacherNote}</span>
        </div>
      ) : null}
      <div className="leave-proof-grid">
        {(request.attachments ?? []).map((attachment) => (
          <ProofPreview
            key={`${request.id}-${attachment.fileName}`}
            attachment={attachment}
          />
        ))}
      </div>
    </article>
  );
}

function getClassAction(course) {
  if (!course.total) {
    return {
      tone: "warning",
      title: "First attendance is pending",
      message: "Attend the first recorded session so this class can start showing real analytics."
    };
  }

  if (course.studentPercentage < 75) {
    return {
      tone: "warning",
      title: `${course.code} needs attendance first`,
      message: `Attend the next ${course.classesNeededForSafeRange || 1} unit${(course.classesNeededForSafeRange || 1) === 1 ? "" : "s"} to reach the safe range.`
    };
  }

  if (course.safeMissesAvailable > 0) {
    return {
      tone: "positive",
      title: "This class is in the safe zone",
      message: `You can miss ${course.safeMissesAvailable} class${course.safeMissesAvailable === 1 ? "" : "es"} and stay above 75%.`
    };
  }

  return {
    tone: "positive",
    title: "Stay present next session",
    message: "You are safe, but the next absence can reduce your margin."
  };
}

export function StudentClassDetailPage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const classId = getHashSearchParam("classId");
  const [dashboard, setDashboard] = useState(null);
  const [leaveDraft, setLeaveDraft] = useState(initialLeaveDraft);
  const [leaveStatus, setLeaveStatus] = useState({
    pending: false,
    tone: "",
    message: ""
  });
  const [status, setStatus] = useState({
    loading: true,
    message: ""
  });

  async function loadDashboard(activeUser = user) {
    if (!activeUser || activeUser.role !== "student") {
      return;
    }

    try {
      const response = await fetchStudentDashboard(activeUser.userId);
      setDashboard({
        ...response,
        profile: {
          ...activeUser,
          ...response.profile,
          ...(readStoredStudentProfile(activeUser.userId) ?? {})
        }
      });
      setStatus({
        loading: false,
        message: ""
      });
    } catch (error) {
      setStatus({
        loading: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to load class analytics."
      });
    }
  }

  useEffect(() => {
    if (!user || user.role !== "student") {
      goToRoute("/login");
      return;
    }

    void loadDashboard();
  }, [classId, user]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
  }

  function updateLeaveDraft(field, value) {
    setLeaveDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
    setLeaveStatus({ pending: false, tone: "", message: "" });
  }

  function handleLeaveFileChange(event) {
    const result = validateLeaveFiles(event.target.files);

    setLeaveDraft((currentDraft) => ({
      ...currentDraft,
      files: result.files
    }));
    setLeaveStatus({
      pending: false,
      tone: result.message ? "warning" : "",
      message: result.message
    });
  }

  async function handleLeaveSubmit(event) {
    event.preventDefault();

    if (!user || !classId) {
      return;
    }

    if (!leaveDraft.absenceDate || !leaveDraft.reason.trim()) {
      setLeaveStatus({
        pending: false,
        tone: "warning",
        message: "Select the absence date and add a reason."
      });
      return;
    }

    if (!leaveDraft.files.length) {
      setLeaveStatus({
        pending: false,
        tone: "warning",
        message: "Upload at least one PDF or image proof document."
      });
      return;
    }

    setLeaveStatus({ pending: true, tone: "", message: "" });

    try {
      const attachments = await convertFilesToAttachments(leaveDraft.files);
      const response = await submitStudentLeaveRequest(user.userId, classId, {
        requestType: leaveDraft.requestType,
        absenceDate: leaveDraft.absenceDate,
        reason: leaveDraft.reason,
        attachments
      });

      setLeaveDraft(initialLeaveDraft);
      setLeaveStatus({
        pending: false,
        tone: "success",
        message: response.message ?? "Leave request submitted."
      });
      await loadDashboard();
    } catch (error) {
      setLeaveStatus({
        pending: false,
        tone: "warning",
        message:
          error instanceof Error ? error.message : "Unable to submit leave request."
      });
    }
  }

  if (!user || user.role !== "student") {
    return null;
  }

  if (status.loading) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard label="Loading" title="Preparing class analytics..." />
        </main>
      </div>
    );
  }

  const course = dashboard?.classPerformance.find(
    (item) => String(item.id) === String(classId)
  );
  const joinedClass = dashboard?.joinedClasses.find(
    (item) => String(item.id) === String(classId)
  );

  if (!dashboard || !course || !joinedClass) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard
            label="Class Not Found"
            title={status.message || "This class is not available in your joined classes."}
            action={
              <button
                className="secondary-button"
                type="button"
                onClick={() => goToRoute("/student-dashboard")}
              >
                Back to Dashboard
              </button>
            }
          />
        </main>
      </div>
    );
  }

  const absent = course.absent ?? Math.max(0, course.total - course.attended);
  const action = getClassAction(course);
  const scheduleSlots = course.scheduleSlots ?? joinedClass.scheduleSlots ?? [];
  const recentAttendance = course.recentAttendance ?? [];
  const leaveRequests = course.leaveRequests ?? [];

  return (
    <div className="page-shell">
      <PageBackground />

      <StudentDashboardHeader
        onLogout={handleLogout}
        onNavigate={scrollToSection}
        showNotificationBell={false}
        navItems={classDetailNavItems}
        utilityAction={{
          label: "Dashboard",
          onClick: () => goToRoute("/student-dashboard")
        }}
      />

      <main className="dashboard-shell student-class-detail-shell">
        <section className="student-class-detail-hero" id="overview">
          <article className="glass-card student-class-detail-intro">
            <div className="dashboard-kicker-row">
              <span className="pill">{course.code}</span>
              <span className={`course-status-badge ${course.statusTone}`}>
                {course.statusLabel}
              </span>
            </div>

            <h1>{course.title}</h1>
            <p>
              {course.faculty} - {joinedClass.section} - {course.room}
            </p>

            <div className="student-class-detail-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  goToRoute(`/class-notes?classId=${encodeURIComponent(course.id)}`)
                }
              >
                Notes
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  goToRoute(
                    `/class-assignments?classId=${encodeURIComponent(course.id)}`
                  )
                }
              >
                Assignments
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  goToRoute(
                    `/class-discussion?classId=${encodeURIComponent(course.id)}`
                  )
                }
              >
                Discussion
              </button>
            </div>
          </article>

          <article className="glass-card student-class-score-card">
            <div
              className="attendance-ring"
              style={{
                "--attendance-progress": `${course.studentPercentage}%`
              }}
            >
              <div className="attendance-ring-core">
                <span>Attendance</span>
                <strong>{course.total ? `${course.studentPercentage}%` : "0%"}</strong>
              </div>
            </div>
            <div className={`student-class-action-card ${action.tone}`}>
              <strong>{action.title}</strong>
              <span>{action.message}</span>
            </div>
          </article>
        </section>

        <section className="student-class-stat-grid">
          <article className="glass-card summary-card">
            <span className="metric-eyebrow">Present</span>
            <strong>{course.attended}</strong>
            <p>Counted attended units in this class.</p>
          </article>
          <article className="glass-card summary-card">
            <span className="metric-eyebrow">Absent</span>
            <strong>{absent}</strong>
            <p>Missed units from recorded attendance.</p>
          </article>
          <article className="glass-card summary-card">
            <span className="metric-eyebrow">Total Units</span>
            <strong>{course.total}</strong>
            <p>Total recorded attendance units for you.</p>
          </article>
          <article className="glass-card summary-card">
            <span className="metric-eyebrow">Class Average</span>
            <strong>{course.classAverage}%</strong>
            <p>Your class benchmark for this subject.</p>
          </article>
        </section>

        <section className="dashboard-main-grid" id="analytics">
          <article className="glass-card dashboard-panel">
            <DashboardPanelHeader
              label="Analytics"
              title="Current percentage and next-class projection."
            />

            <div className="course-bars">
              <MetricBar label="You" value={course.studentPercentage} tone="student" />
              <MetricBar label="Class Avg" value={course.classAverage} tone="average" />
              <MetricBar label="+ Present" value={course.projectedAfterPresent} tone="friends" />
              <MetricBar label="+ Absent" value={course.projectedAfterAbsent} tone="average" />
            </div>

            <div className="student-class-projection-grid">
              <div>
                <span>Recovery Needed</span>
                <strong>
                  {course.classesNeededForSafeRange
                    ? `${course.classesNeededForSafeRange} units`
                    : "None"}
                </strong>
              </div>
              <div>
                <span>Safe Misses</span>
                <strong>{course.safeMissesAvailable}</strong>
              </div>
              <div>
                <span>Last Status</span>
                <strong>{course.lastStatus}</strong>
              </div>
            </div>
          </article>

          <article className="glass-card dashboard-panel">
            <DashboardPanelHeader label="Class Info" title="Quick reference." />

            <div className="student-class-info-list">
              <div>
                <span>Teacher</span>
                <strong>{course.faculty}</strong>
              </div>
              <div>
                <span>Room</span>
                <strong>{course.room}</strong>
              </div>
              <div>
                <span>Semester</span>
                <strong>{course.semesterLabel || joinedClass.semesterLabel || "Not set"}</strong>
              </div>
              <div>
                <span>Students Joined</span>
                <strong>{joinedClass.studentsCount}</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="dashboard-lower-grid" id="leave">
          <article className="glass-card dashboard-panel">
            <DashboardPanelHeader
              label="Leave Proof"
              title="Submit medical reports or absence documents."
              description="Upload PDF or image proof with a clear reason. Your teacher can approve or reject it from student details."
            />

            <form className="student-leave-form" onSubmit={handleLeaveSubmit}>
              <div className="student-leave-form-grid">
                <label className="field">
                  <span>Request type</span>
                  <select
                    value={leaveDraft.requestType}
                    onChange={(event) =>
                      updateLeaveDraft("requestType", event.target.value)
                    }
                  >
                    <option value="medical">Medical</option>
                    <option value="leave">Leave</option>
                    <option value="other">Other absence</option>
                  </select>
                </label>
                <label className="field">
                  <span>Absence date</span>
                  <input
                    type="date"
                    value={leaveDraft.absenceDate}
                    onChange={(event) =>
                      updateLeaveDraft("absenceDate", event.target.value)
                    }
                  />
                </label>
              </div>

              <label className="field">
                <span>Reason</span>
                <textarea
                  value={leaveDraft.reason}
                  onChange={(event) => updateLeaveDraft("reason", event.target.value)}
                  rows="4"
                  placeholder="Explain why you were absent and what proof you are attaching."
                />
              </label>

              <label className="field">
                <span>Proof documents</span>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  multiple
                  onChange={handleLeaveFileChange}
                />
              </label>

              {leaveDraft.files.length ? (
                <div className="student-leave-selected-files">
                  {leaveDraft.files.map((file) => (
                    <span key={`${file.name}-${file.size}-${file.lastModified}`}>
                      {file.name} • {formatFileSize(file.size)}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="student-class-detail-actions">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={leaveStatus.pending}
                >
                  {leaveStatus.pending ? "Submitting..." : "Submit Request"}
                </button>
                {leaveStatus.message ? (
                  <span className={`student-leave-status ${leaveStatus.tone}`}>
                    {leaveStatus.message}
                  </span>
                ) : null}
              </div>
            </form>
          </article>

          <article className="glass-card dashboard-panel">
            <DashboardPanelHeader
              label="Submitted Requests"
              title="Teacher review status."
            />

            <div className="student-leave-request-list">
              {leaveRequests.length ? (
                leaveRequests.map((request) => (
                  <LeaveRequestCard key={request.id} request={request} />
                ))
              ) : (
                <p className="panel-fallback">
                  No leave or absence proof submitted for this class yet.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="dashboard-lower-grid">
          <article className="glass-card dashboard-panel" id="history">
            <DashboardPanelHeader label="History" title="Recent attendance records." />

            <div className="student-class-history-list">
              {recentAttendance.length ? (
                recentAttendance.map((record) => (
                  <article
                    key={record.id}
                    className={`student-class-history-row ${record.statusTone}`}
                  >
                    <div>
                      <strong>{record.statusLabel}</strong>
                      <span>{record.recordedLabel}</span>
                    </div>
                    <div>
                      <span>
                        {record.sessionType === "extra" ? "Extra Class" : "Scheduled Class"}{" "}
                        •{" "}
                        Unit {record.attendanceUnit ?? 1}
                      </span>
                      <span>{formatMethod(record.verificationMethod)}</span>
                      {formatConfidence(record.confidence) ? (
                        <small>{formatConfidence(record.confidence)}</small>
                      ) : null}
                    </div>
                    {record.notes ? <p>{record.notes}</p> : null}
                  </article>
                ))
              ) : (
                <p className="panel-fallback">
                  No attendance has been recorded for this class yet.
                </p>
              )}
            </div>
          </article>

          <article className="glass-card dashboard-panel" id="schedule">
            <DashboardPanelHeader label="Schedule" title="Regular class timings." />

            <div className="student-class-schedule-list">
              {scheduleSlots.length ? (
                scheduleSlots.map((slot) => (
                  <div
                    key={`${slot.day}-${slot.startTime}-${slot.endTime}`}
                    className="student-class-schedule-row"
                  >
                    <strong>{slot.shortDayLabel ?? slot.day}</strong>
                    <span>{slot.timeLabel}</span>
                    <small>{course.room}</small>
                  </div>
                ))
              ) : (
                <p className="panel-fallback">Schedule is not announced yet.</p>
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
