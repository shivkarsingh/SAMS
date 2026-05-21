import { useEffect, useMemo, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  createClassAssignment,
  fetchClassAssignments,
  submitClassAssignment
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { getHashSearchParam, goToRoute } from "../../utils/router";
import "../TeacherDashboardPage/TeacherDashboardPage.css";
import "./ClassAssignmentsPage.css";

const initialAssignmentForm = {
  title: "",
  instructions: "",
  deadlineAt: "",
  files: []
};
const MAX_ASSIGNMENT_FILES = 6;
const MAX_ASSIGNMENT_FILE_BYTES = 5 * 1024 * 1024;

const teacherAssignmentFilters = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "submitted", label: "Turned In" },
  { id: "missing", label: "Missing" },
  { id: "late", label: "Late" }
];

const studentAssignmentFilters = [
  { id: "all", label: "All" },
  { id: "open", label: "Assigned" },
  { id: "submitted", label: "Turned In" },
  { id: "missing", label: "Missing" },
  { id: "late", label: "Late" }
];

function formatDateTime(value) {
  if (!value) {
    return "No deadline";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
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

function getStudentPhotoUrl(student) {
  return (
    student?.profilePhotoUrl ||
    student?.avatarDataUrl ||
    student?.faceProfilePhotoUrl ||
    ""
  );
}

function AssignmentStudentAvatar({ student }) {
  const displayName = student?.studentName || student?.studentUserId || "Student";
  const photoUrl = getStudentPhotoUrl(student);

  return (
    <span className="assignment-student-avatar" aria-hidden="true">
      {photoUrl ? <img src={photoUrl} alt="" /> : getInitials(displayName)}
    </span>
  );
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  const escapedValue = stringValue.replace(/"/g, '""');

  return /[",\n]/.test(escapedValue) ? `"${escapedValue}"` : escapedValue;
}

function downloadFile(content, fileName, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildCsv(rows) {
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

function getTimestamp(value) {
  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getAssignmentSlug(classroom, suffix) {
  return `${classroom.subjectCode || classroom.subjectName}-${suffix}`
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function validateSelectedFiles(files) {
  const selectedFiles = Array.from(files ?? []);
  const acceptedFiles = selectedFiles
    .filter((file) => file.size <= MAX_ASSIGNMENT_FILE_BYTES)
    .slice(0, MAX_ASSIGNMENT_FILES);

  if (selectedFiles.length > MAX_ASSIGNMENT_FILES) {
    return {
      files: acceptedFiles,
      message: `Use up to ${MAX_ASSIGNMENT_FILES} files. The first ${MAX_ASSIGNMENT_FILES} valid file(s) were selected.`
    };
  }

  if (selectedFiles.some((file) => file.size > MAX_ASSIGNMENT_FILE_BYTES)) {
    return {
      files: acceptedFiles,
      message: `Each file must be ${formatFileSize(MAX_ASSIGNMENT_FILE_BYTES)} or smaller. Oversized files were skipped.`
    };
  }

  return {
    files: acceptedFiles,
    message: ""
  };
}

function isPastDue(assignment) {
  return getTimestamp(assignment.deadlineAt) < Date.now();
}

function getDueState(assignment) {
  const dueAt = getTimestamp(assignment.deadlineAt);

  if (!dueAt) {
    return {
      label: "No deadline",
      tone: "neutral"
    };
  }

  const remainingMs = dueAt - Date.now();

  if (remainingMs < 0) {
    return {
      label: "Past due",
      tone: "overdue"
    };
  }

  if (remainingMs <= 24 * 60 * 60 * 1000) {
    return {
      label: "Due soon",
      tone: "soon"
    };
  }

  return {
    label: "Open",
    tone: "open"
  };
}

function getAssignmentState(assignment) {
  if (assignment.mySubmission) {
    return assignment.mySubmission.status === "late" ? "Turned in late" : "Turned in";
  }

  return isPastDue(assignment) ? "Missing" : "Assigned";
}

function getTeacherAssignmentState(assignment) {
  const assignedStudentCount = Number(assignment.assignedStudentCount ?? 0);
  const submittedCount = Number(assignment.submissionCount ?? 0);
  const missingCount = Number(assignment.missingSubmissionCount ?? 0);
  const lateCount = Number(assignment.lateSubmissionCount ?? 0);

  if (lateCount > 0) {
    return {
      label: `${lateCount} late`,
      className: "late"
    };
  }

  if (isPastDue(assignment) && missingCount > 0) {
    return {
      label: `${missingCount} missing`,
      className: "missing"
    };
  }

  if (assignedStudentCount > 0 && submittedCount >= assignedStudentCount) {
    return {
      label: "All turned in",
      className: "turned-in"
    };
  }

  return {
    label: `${submittedCount}/${assignedStudentCount} turned in`,
    className: "assigned"
  };
}

function getStudentStateClass(assignment) {
  return getAssignmentState(assignment).toLowerCase().replace(/\s+/g, "-");
}

function matchesAssignmentFilter(assignment, filterId, role) {
  if (filterId === "all") {
    return true;
  }

  if (filterId === "open") {
    return role === "teacher"
      ? !isPastDue(assignment)
      : !assignment.mySubmission && !isPastDue(assignment);
  }

  if (filterId === "submitted") {
    return role === "teacher"
      ? Number(assignment.submissionCount ?? 0) > 0
      : Boolean(assignment.mySubmission);
  }

  if (filterId === "missing") {
    return role === "teacher"
      ? Number(assignment.missingSubmissionCount ?? 0) > 0
      : !assignment.mySubmission && isPastDue(assignment);
  }

  if (filterId === "late") {
    return role === "teacher"
      ? Number(assignment.lateSubmissionCount ?? 0) > 0
      : assignment.mySubmission?.status === "late";
  }

  return true;
}

async function convertFilesToAttachments(files) {
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

function SelectedFileList({ files, onRemove }) {
  if (!files.length) {
    return null;
  }

  return (
    <div className="assignment-selected-files">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${file.size}-${file.lastModified}`}
          className="assignment-selected-file"
        >
          <div>
            <strong>{file.name}</strong>
            <span>{formatFileSize(file.size)}</span>
          </div>
          <button type="button" onClick={() => onRemove(index)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

function AssignmentAttachmentList({ attachments, idPrefix }) {
  if (!attachments?.length) {
    return null;
  }

  return (
    <div className="assignment-attachment-list">
      {attachments.map((attachment) => (
        <a
          key={`${idPrefix}-${attachment.fileName}`}
          className="assignment-attachment"
          href={attachment.dataUrl}
          download={attachment.fileName}
        >
          <strong>{attachment.fileName}</strong>
          <span>{formatFileSize(attachment.fileSize)}</span>
        </a>
      ))}
    </div>
  );
}

export function ClassAssignmentsPage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const classId = getHashSearchParam("classId");
  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState(initialAssignmentForm);
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [submissionDrafts, setSubmissionDrafts] = useState({});
  const [pageStatus, setPageStatus] = useState({
    loading: true,
    message: ""
  });
  const [formStatus, setFormStatus] = useState({
    pending: false,
    tone: "",
    message: ""
  });

  async function loadAssignments() {
    if (!user || !classId) {
      return;
    }

    const response = await fetchClassAssignments(user.userId, user.role, classId);
    setClassroom(response.classroom);
    setAssignments(response.assignments);
  }

  useEffect(() => {
    if (!user) {
      goToRoute("/login");
      return;
    }

    if (!classId) {
      setPageStatus({
        loading: false,
        message: "A classroom ID is required to open assignments."
      });
      return;
    }

    async function loadInitialAssignments() {
      try {
        await loadAssignments();
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
              : "Unable to load assignments."
        });
      }
    }

    void loadInitialAssignments();
  }, [classId, user]);

  const assignmentFilters =
    user?.role === "teacher" ? teacherAssignmentFilters : studentAssignmentFilters;

  const assignmentSummary = useMemo(() => {
    if (user?.role === "teacher") {
      return {
        total: assignments.length,
        open: assignments.filter((assignment) => !isPastDue(assignment)).length,
        submitted: assignments.reduce(
          (total, assignment) => total + Number(assignment.submissionCount ?? 0),
          0
        ),
        missing: assignments.reduce(
          (total, assignment) =>
            total + Number(assignment.missingSubmissionCount ?? 0),
          0
        ),
        late: assignments.reduce(
          (total, assignment) => total + Number(assignment.lateSubmissionCount ?? 0),
          0
        )
      };
    }

    return {
      total: assignments.length,
      open: assignments.filter(
        (assignment) => !assignment.mySubmission && !isPastDue(assignment)
      ).length,
      submitted: assignments.filter((assignment) => assignment.mySubmission).length,
      missing: assignments.filter(
        (assignment) => !assignment.mySubmission && isPastDue(assignment)
      ).length,
      late: assignments.filter(
        (assignment) => assignment.mySubmission?.status === "late"
      ).length
    };
  }, [assignments, user?.role]);

  const visibleAssignments = useMemo(() => {
    const normalizedSearch = assignmentSearch.trim().toLowerCase();

    return assignments.filter((assignment) => {
      const matchesFilter = matchesAssignmentFilter(
        assignment,
        assignmentFilter,
        user?.role
      );
      const searchableText = `${assignment.title} ${assignment.instructions}`.toLowerCase();
      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [assignmentFilter, assignmentSearch, assignments, user?.role]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
  }

  function removeAssignmentFile(fileIndex) {
    setAssignmentForm((currentForm) => ({
      ...currentForm,
      files: currentForm.files.filter((_, index) => index !== fileIndex)
    }));
  }

  function removeSubmissionFile(assignmentId, fileIndex) {
    setSubmissionDrafts((currentDrafts) => {
      const currentDraft = currentDrafts[assignmentId] ?? {
        files: [],
        comment: ""
      };

      return {
        ...currentDrafts,
        [assignmentId]: {
          ...currentDraft,
          files: currentDraft.files.filter((_, index) => index !== fileIndex)
        }
      };
    });
  }

  function handleAssignmentFileChange(event) {
    const { files, message } = validateSelectedFiles(event.target.files);

    setAssignmentForm((currentForm) => ({
      ...currentForm,
      files
    }));

    setFormStatus({
      pending: false,
      tone: message ? "warning" : "",
      message
    });
  }

  function handleSubmissionFileChange(event, assignmentId, submissionDraft) {
    const { files, message } = validateSelectedFiles(event.target.files);

    setSubmissionDrafts((currentDrafts) => ({
      ...currentDrafts,
      [assignmentId]: {
        ...submissionDraft,
        files,
        pending: false,
        tone: message ? "warning" : "",
        message
      }
    }));
  }

  function downloadAssignmentReport(assignment) {
    const submittedRows = (assignment.submissions ?? []).map((submission) => [
      assignment.title,
      formatDateTime(assignment.deadlineAt),
      submission.rollNumber || submission.studentUserId,
      submission.studentUserId,
      submission.studentName,
      submission.status,
      formatDateTime(submission.submittedAt),
      (submission.attachments ?? []).map((attachment) => attachment.fileName).join("; "),
      submission.comment || ""
    ]);
    const missingRows = (assignment.missingSubmissions ?? []).map((student) => [
      assignment.title,
      formatDateTime(assignment.deadlineAt),
      student.rollNumber || student.studentUserId,
      student.studentUserId,
      student.studentName,
      "missing",
      "",
      "",
      ""
    ]);
    const csvContent = buildCsv([
      [
        "Assignment",
        "Due",
        "Roll No",
        "Student ID",
        "Student Name",
        "Status",
        "Submitted At",
        "Files",
        "Comment"
      ],
      ...submittedRows,
      ...missingRows
    ]);

    downloadFile(
      csvContent,
      `${getAssignmentSlug(classroom, assignment.title)}-report.csv`,
      "text/csv;charset=utf-8"
    );
  }

  function downloadVisibleAssignmentSummary() {
    const csvContent = buildCsv([
      [
        "Assignment",
        "Due",
        "State",
        "Assigned Students",
        "Turned In",
        "Missing",
        "Late"
      ],
      ...visibleAssignments.map((assignment) => {
        const teacherState = getTeacherAssignmentState(assignment);

        return [
          assignment.title,
          formatDateTime(assignment.deadlineAt),
          teacherState.label,
          assignment.assignedStudentCount ?? 0,
          assignment.submissionCount ?? 0,
          assignment.missingSubmissionCount ?? 0,
          assignment.lateSubmissionCount ?? 0
        ];
      })
    ]);

    downloadFile(
      csvContent,
      `${getAssignmentSlug(classroom, "assignments")}-summary.csv`,
      "text/csv;charset=utf-8"
    );
  }

  async function handleCreateAssignment(event) {
    event.preventDefault();

    if (!assignmentForm.title.trim() || !assignmentForm.deadlineAt) {
      setFormStatus({
        pending: false,
        tone: "warning",
        message: "Add an assignment title and deadline."
      });
      return;
    }

    if (getTimestamp(assignmentForm.deadlineAt) <= Date.now()) {
      setFormStatus({
        pending: false,
        tone: "warning",
        message: "Choose a future deadline for this assignment."
      });
      return;
    }

    setFormStatus({ pending: true, tone: "", message: "" });

    try {
      const attachments = await convertFilesToAttachments(assignmentForm.files);
      const response = await createClassAssignment(user.userId, classId, {
        title: assignmentForm.title,
        instructions: assignmentForm.instructions,
        deadlineAt: assignmentForm.deadlineAt,
        attachments
      });

      await loadAssignments();
      setAssignmentForm(initialAssignmentForm);
      setFormStatus({
        pending: false,
        tone: "success",
        message: response.message
      });
    } catch (error) {
      setFormStatus({
        pending: false,
        tone: "warning",
        message:
          error instanceof Error ? error.message : "Unable to post assignment."
      });
    }
  }

  async function handleSubmitAssignment(event, assignmentId) {
    event.preventDefault();
    const currentDraft = submissionDrafts[assignmentId] ?? {
      files: [],
      comment: ""
    };

    if (!currentDraft.comment?.trim() && !currentDraft.files?.length) {
      setSubmissionDrafts((currentDrafts) => ({
        ...currentDrafts,
        [assignmentId]: {
          ...currentDraft,
          pending: false,
          tone: "warning",
          message: "Attach a file or add a private comment before turning in."
        }
      }));
      return;
    }

    setSubmissionDrafts((currentDrafts) => ({
      ...currentDrafts,
      [assignmentId]: {
        ...currentDraft,
        pending: true,
        message: "",
        tone: ""
      }
    }));

    try {
      const attachments = await convertFilesToAttachments(currentDraft.files ?? []);
      const response = await submitClassAssignment(user.userId, classId, assignmentId, {
        comment: currentDraft.comment ?? "",
        attachments
      });

      await loadAssignments();
      setSubmissionDrafts((currentDrafts) => ({
        ...currentDrafts,
        [assignmentId]: {
          files: [],
          comment: "",
          pending: false,
          tone: "success",
          message: response.message
        }
      }));
    } catch (error) {
      setSubmissionDrafts((currentDrafts) => ({
        ...currentDrafts,
        [assignmentId]: {
          ...currentDraft,
          pending: false,
          tone: "warning",
          message:
            error instanceof Error
              ? error.message
              : "Unable to submit assignment."
        }
      }));
    }
  }

  if (!user) {
    return null;
  }

  if (pageStatus.loading) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard label="Loading" title="Opening class assignments..." />
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
            label="Assignments Error"
            title={pageStatus.message || "Unable to load assignments."}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="dashboard-topbar glass-card">
        <AppBrand href="#/" subtitle="Class Assignments" />

        <nav className="dashboard-nav">
          <button className="dashboard-nav-button active-teacher-nav" type="button">
            Assignments
          </button>
        </nav>

        <div className="dashboard-header-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              goToRoute(
                user.role === "teacher"
                  ? `/teacher-classroom?classId=${encodeURIComponent(classId)}`
                  : "/student-dashboard"
              )
            }
          >
            Back
          </button>
          <button className="primary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-shell class-assignments-shell">
        <section className="class-assignments-heading">
          <div>
            <span className="pill">Classwork</span>
            <h1>{classroom.subjectName} assignments</h1>
            <p className="course-meta">
              {classroom.subjectName} • {classroom.subjectCode}
            </p>
          </div>

          <div className="assignment-summary-grid" aria-label="Assignment summary">
            <div>
              <span>{user.role === "teacher" ? "Posted" : "Total"}</span>
              <strong>{assignmentSummary.total}</strong>
            </div>
            <div>
              <span>{user.role === "teacher" ? "Open" : "Assigned"}</span>
              <strong>{assignmentSummary.open}</strong>
            </div>
            <div>
              <span>Turned In</span>
              <strong>{assignmentSummary.submitted}</strong>
            </div>
            <div>
              <span>Missing</span>
              <strong>{assignmentSummary.missing}</strong>
            </div>
          </div>
        </section>

        {user.role === "teacher" ? (
          <section className="glass-card dashboard-panel assignment-create-panel">
            <div className="dashboard-panel-header">
              <div>
                <span className="pill">Create</span>
                <h2>New assignment</h2>
              </div>
              <span className="assignment-status">{assignmentSummary.late} late</span>
            </div>

            <form className="assignment-create-form" onSubmit={handleCreateAssignment}>
              <div className="assignment-form-grid">
                <label className="field">
                  <span>Title</span>
                  <input
                    type="text"
                    value={assignmentForm.title}
                    onChange={(event) =>
                      setAssignmentForm((currentForm) => ({
                        ...currentForm,
                        title: event.target.value
                      }))
                    }
                    placeholder="Worksheet 3: Probability"
                    required
                  />
                </label>

                <label className="field">
                  <span>Deadline</span>
                  <input
                    type="datetime-local"
                    value={assignmentForm.deadlineAt}
                    onChange={(event) =>
                      setAssignmentForm((currentForm) => ({
                        ...currentForm,
                        deadlineAt: event.target.value
                      }))
                    }
                    required
                  />
                </label>
              </div>

              <label className="field">
                <span>Instructions</span>
                <textarea
                  rows="4"
                  value={assignmentForm.instructions}
                  onChange={(event) =>
                    setAssignmentForm((currentForm) => ({
                      ...currentForm,
                      instructions: event.target.value
                    }))
                  }
                  placeholder="Solve all questions and attach your work."
                />
              </label>

              <div className="assignment-file-picker">
                <label className="assignment-file-dropzone">
                  <input
                    type="file"
                    multiple
                    onChange={handleAssignmentFileChange}
                  />
                  <span>+</span>
                  <div>
                    <strong>Upload assignment files</strong>
                    <small>
                      {assignmentForm.files.length
                        ? `${assignmentForm.files.length} selected`
                        : "PDF, DOC, image, or spreadsheet"}
                    </small>
                  </div>
                </label>
                <SelectedFileList
                  files={assignmentForm.files}
                  onRemove={removeAssignmentFile}
                />
              </div>

              <div className="assignment-form-actions">
                <button className="primary-button" type="submit" disabled={formStatus.pending}>
                  {formStatus.pending ? "Posting..." : "Post Assignment"}
                </button>
                {formStatus.message ? (
                  <span className={`assignment-status ${formStatus.tone}`}>
                    {formStatus.message}
                  </span>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}

        <section className="glass-card dashboard-panel assignment-filter-panel">
          <div className="assignment-filter-head">
            <div>
              <span className="pill">Stream</span>
              <h2>{user.role === "teacher" ? "Class submissions" : "Your work"}</h2>
            </div>

            <div className="assignment-filter-actions">
              <label className="field assignment-search-field">
                <span>Search</span>
                <input
                  type="search"
                  value={assignmentSearch}
                  onChange={(event) => setAssignmentSearch(event.target.value)}
                  placeholder="Search assignments"
                />
              </label>

              {user.role === "teacher" ? (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!visibleAssignments.length}
                  onClick={downloadVisibleAssignmentSummary}
                >
                  Download Summary
                </button>
              ) : null}
            </div>
          </div>

          <div className="assignment-filter-row">
            {assignmentFilters.map((filter) => {
              const filterCount = assignments.filter((assignment) =>
                matchesAssignmentFilter(assignment, filter.id, user.role)
              ).length;

              return (
                <button
                  key={filter.id}
                  className={`role-tab ${assignmentFilter === filter.id ? "active" : ""}`}
                  type="button"
                  onClick={() => setAssignmentFilter(filter.id)}
                >
                  {filter.label}
                  <span>{filterCount}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="assignment-stream">
          {visibleAssignments.length ? (
            visibleAssignments.map((assignment) => {
              const submissionDraft = submissionDrafts[assignment.id] ?? {
                files: [],
                comment: ""
              };
              const dueState = getDueState(assignment);
              const teacherState = getTeacherAssignmentState(assignment);

              return (
                <article key={assignment.id} className="glass-card assignment-card">
                  <div className="assignment-card-main">
                    <div className="assignment-icon">A</div>
                    <div className="assignment-copy">
                      <div className="assignment-card-head">
                        <div>
                          <div className="assignment-title-row">
                            <h2>{assignment.title}</h2>
                            <span className={`assignment-due-chip ${dueState.tone}`}>
                              {dueState.label}
                            </span>
                          </div>
                          <span>
                            Posted {formatDateTime(assignment.createdAt)} • Due{" "}
                            {formatDateTime(assignment.deadlineAt)}
                          </span>
                        </div>
                        <span
                          className={`assignment-state ${
                            user.role === "teacher"
                              ? teacherState.className
                              : getStudentStateClass(assignment)
                          }`}
                        >
                          {user.role === "teacher"
                            ? teacherState.label
                            : getAssignmentState(assignment)}
                        </span>
                        {user.role === "teacher" ? (
                          <button
                            className="assignment-report-button"
                            type="button"
                            onClick={() => downloadAssignmentReport(assignment)}
                          >
                            Download Report
                          </button>
                        ) : null}
                      </div>

                      {assignment.instructions ? (
                        <p>{assignment.instructions}</p>
                      ) : null}

                      <AssignmentAttachmentList
                        attachments={assignment.attachments}
                        idPrefix={assignment.id}
                      />

                      <div className="assignment-classwork-metrics">
                        {user.role === "teacher" ? (
                          <>
                            <div>
                              <span>Turned in</span>
                              <strong>{assignment.submissionCount ?? 0}</strong>
                            </div>
                            <div>
                              <span>Assigned</span>
                              <strong>{assignment.assignedStudentCount ?? 0}</strong>
                            </div>
                            <div>
                              <span>Late</span>
                              <strong>{assignment.lateSubmissionCount ?? 0}</strong>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <span>Status</span>
                              <strong>{getAssignmentState(assignment)}</strong>
                            </div>
                            <div>
                              <span>Due</span>
                              <strong>{formatDateTime(assignment.deadlineAt)}</strong>
                            </div>
                            <div>
                              <span>Files</span>
                              <strong>{assignment.attachments?.length ?? 0}</strong>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {user.role === "teacher" ? (
                    <div
                      className={`assignment-review-panel ${
                        assignment.missingSubmissions?.length ? "" : "single-column"
                      }`}
                    >
                      <div className="assignment-review-column">
                        <div className="assignment-review-heading">
                          <h3>Student work</h3>
                          <span>
                            {assignment.submissionCount ?? 0} of{" "}
                            {assignment.assignedStudentCount ?? 0}
                          </span>
                        </div>
                        {assignment.submissions?.length ? (
                          <div className="assignment-submission-list">
                            {assignment.submissions.map((submission) => (
                              <article key={submission.id} className="assignment-submission-row">
                                <div className="assignment-student-summary">
                                  <AssignmentStudentAvatar student={submission} />
                                  <div>
                                    <strong>{submission.studentName}</strong>
                                    <span>
                                      Roll {submission.rollNumber || submission.studentUserId} •{" "}
                                      {submission.status} •{" "}
                                      {formatDateTime(submission.submittedAt)}
                                    </span>
                                  </div>
                                </div>
                                <div className="assignment-submission-files">
                                  {(submission.attachments ?? []).map((attachment) => (
                                    <a
                                      key={`${submission.id}-${attachment.fileName}`}
                                      href={attachment.dataUrl}
                                      download={attachment.fileName}
                                    >
                                      {attachment.fileName}
                                    </a>
                                  ))}
                                  {submission.comment ? <span>{submission.comment}</span> : null}
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="panel-fallback">No submissions yet.</p>
                        )}
                      </div>

                      {assignment.missingSubmissions?.length ? (
                        <div className="assignment-review-column assignment-missing-column">
                          <div className="assignment-review-heading">
                            <h3>Missing</h3>
                            <span>{assignment.missingSubmissionCount}</span>
                          </div>
                          <div className="assignment-missing-list">
                            {assignment.missingSubmissions.slice(0, 8).map((student) => (
                              <div
                                key={`${assignment.id}-${student.studentUserId}`}
                                className="assignment-missing-student"
                              >
                                <AssignmentStudentAvatar student={student} />
                                <span>
                                  {student.rollNumber || student.studentUserId} •{" "}
                                  {student.studentName}
                                </span>
                              </div>
                            ))}
                            {assignment.missingSubmissions.length > 8 ? (
                              <strong>
                                +{assignment.missingSubmissions.length - 8} more
                              </strong>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <form
                      className="student-work-panel"
                      onSubmit={(event) => handleSubmitAssignment(event, assignment.id)}
                    >
                      <div className="student-work-head">
                        <div>
                          <h3>Your work</h3>
                          {assignment.mySubmission ? (
                            <span>
                              Submitted {formatDateTime(assignment.mySubmission.submittedAt)}
                            </span>
                          ) : (
                            <span>Not submitted</span>
                          )}
                        </div>
                        <span className={`assignment-state ${getStudentStateClass(assignment)}`}>
                          {getAssignmentState(assignment)}
                        </span>
                      </div>

                      <AssignmentAttachmentList
                        attachments={assignment.mySubmission?.attachments}
                        idPrefix={assignment.mySubmission?.id ?? assignment.id}
                      />

                      <div className="assignment-file-picker compact">
                        <label className="assignment-file-dropzone">
                          <input
                            type="file"
                            multiple
                            onChange={(event) =>
                              handleSubmissionFileChange(
                                event,
                                assignment.id,
                                submissionDraft
                              )
                            }
                          />
                          <span>+</span>
                          <div>
                            <strong>Add work</strong>
                            <small>
                              {submissionDraft.files?.length
                                ? `${submissionDraft.files.length} selected`
                                : "Attach files"}
                            </small>
                          </div>
                        </label>
                        <SelectedFileList
                          files={submissionDraft.files ?? []}
                          onRemove={(fileIndex) =>
                            removeSubmissionFile(assignment.id, fileIndex)
                          }
                        />
                      </div>

                      <label className="field">
                        <span>Private comment</span>
                        <textarea
                          rows="3"
                          value={submissionDraft.comment ?? ""}
                          onChange={(event) =>
                            setSubmissionDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [assignment.id]: {
                                ...submissionDraft,
                                comment: event.target.value
                              }
                            }))
                          }
                          placeholder="Add a note for your teacher."
                        />
                      </label>

                      <div className="assignment-form-actions">
                        <button
                          className="primary-button"
                          type="submit"
                          disabled={submissionDraft.pending}
                        >
                          {submissionDraft.pending
                            ? "Submitting..."
                            : assignment.mySubmission
                              ? "Resubmit"
                              : "Turn In"}
                        </button>
                        {submissionDraft.message ? (
                          <span className={`assignment-status ${submissionDraft.tone}`}>
                            {submissionDraft.message}
                          </span>
                        ) : null}
                      </div>
                    </form>
                  )}
                </article>
              );
            })
          ) : (
            <article className="glass-card dashboard-panel">
              <p className="panel-fallback">
                {assignments.length
                  ? "No assignments match the current filters."
                  : "No assignments have been posted for this class yet."}
              </p>
            </article>
          )}
        </section>
      </main>
    </div>
  );
}
