import { useEffect, useMemo, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  addTeacherClassroomStudent,
  deleteTeacherClassroomStudent,
  fetchTeacherClassroom,
  reviewTeacherLeaveRequest,
  updateTeacherClassroomStudent
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { getHashSearchParam, goToRoute } from "../../utils/router";
import "../TeacherDashboardPage/TeacherDashboardPage.css";
import "../TeacherClassroomPage/TeacherClassroomPage.css";
import "./TeacherClassroomStudentsPage.css";

const attendanceFilters = [
  { id: "all", label: "All Students" },
  { id: "low", label: "Below Range" },
  { id: "high", label: "Above Range" }
];

const attendanceSortOptions = [
  { id: "roll", label: "Roll No" },
  { id: "name", label: "Name" },
  { id: "attendance-asc", label: "Attendance Low to High" },
  { id: "attendance-desc", label: "Attendance High to Low" }
];

const emptyStudentForm = {
  userId: "",
  firstName: "",
  lastName: "",
  rollNumber: "",
  email: "",
  department: "",
  batch: "",
  password: "",
  confirmPassword: ""
};

const rollNumberCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base"
});

function compareStudentsByRollNumber(left, right) {
  const rollComparison = rollNumberCollator.compare(
    left.rollNumber || left.studentUserId,
    right.rollNumber || right.studentUserId
  );

  if (rollComparison !== 0) {
    return rollComparison;
  }

  return String(left.studentName).localeCompare(String(right.studentName));
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

function clampSafeRange(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 75;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function getAttendanceFilterCount(roster, filterId, safeRange) {
  return roster.filter((student) =>
    matchesAttendanceFilter(student, filterId, safeRange)
  ).length;
}

function matchesAttendanceFilter(student, filterId, safeRange) {
  if (filterId === "low") {
    return student.attendancePercentage < safeRange;
  }

  if (filterId === "high") {
    return student.attendancePercentage >= safeRange;
  }

  return true;
}

function getClampedPercentage(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, numericValue));
}

function escapeCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCalendarMonthDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingEmptyDays = firstDay.getDay();

  return [
    ...Array.from({ length: leadingEmptyDays }, (_item, index) => ({
      key: `empty-${index}`,
      empty: true
    })),
    ...Array.from({ length: daysInMonth }, (_item, index) => {
      const date = new Date(year, month, index + 1);

      return {
        key: getLocalDateKey(date),
        label: index + 1
      };
    })
  ];
}

function getMonthLabel(monthDate) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric"
  }).format(monthDate);
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

function ProofPreview({ attachment }) {
  const isImage = String(attachment.fileType ?? "").startsWith("image/");
  const isPdf = attachment.fileType === "application/pdf";

  return (
    <article className="teacher-leave-proof-preview">
      <div className="teacher-leave-proof-head">
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

function getStatusCounts(records = []) {
  return records.reduce(
    (counts, record) => ({
      ...counts,
      [record.status]: (counts[record.status] ?? 0) + 1
    }),
    {
      present: 0,
      absent: 0,
      cancelled: 0,
      late: 0
    }
  );
}

export function TeacherClassroomStudentsPage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const classId = getHashSearchParam("classId");
  const [classroomData, setClassroomData] = useState(null);
  const [pageStatus, setPageStatus] = useState({
    loading: true,
    message: ""
  });
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("roll");
  const [safeRange, setSafeRange] = useState(75);
  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [editingStudentId, setEditingStudentId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [leaveReviewNotes, setLeaveReviewNotes] = useState({});
  const [leaveReviewStatus, setLeaveReviewStatus] = useState({
    pendingId: "",
    message: ""
  });
  const [rosterStatus, setRosterStatus] = useState({
    loading: false,
    message: ""
  });
  const hasStudentPasswordMismatch =
    studentForm.password &&
    studentForm.confirmPassword &&
    studentForm.password !== studentForm.confirmPassword;

  async function loadClassroom() {
    if (!user || user.role !== "teacher" || !classId) {
      return;
    }

    try {
      const response = await fetchTeacherClassroom(user.userId, classId);
      setClassroomData(response);
      setSafeRange(clampSafeRange(response.overview?.lowAttendanceThreshold ?? 75));
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
            : "Unable to load student details."
      });
    }
  }

  useEffect(() => {
    if (!user || user.role !== "teacher") {
      goToRoute("/login");
      return;
    }

    if (!classId) {
      setPageStatus({
        loading: false,
        message: "A classroom ID is required to open student details."
      });
      return;
    }

    void loadClassroom();
  }, [classId, user]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
  }

  function updateStudentForm(field, value) {
    setStudentForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function resetStudentForm() {
    setStudentForm(emptyStudentForm);
    setEditingStudentId("");
    setRosterStatus({ loading: false, message: "" });
  }

  function startEditingStudent(student) {
    const [firstName = "", ...lastNameParts] = String(student.studentName ?? "")
      .trim()
      .split(/\s+/);

    setEditingStudentId(student.studentUserId);
    setStudentForm({
      userId: student.studentUserId,
      firstName,
      lastName: lastNameParts.join(" "),
      rollNumber: student.rollNumber || student.studentUserId,
      email: student.email ?? "",
      department: student.department ?? "",
      batch: student.batch ?? "",
      password: "",
      confirmPassword: ""
    });
    setRosterStatus({ loading: false, message: "" });
  }

  function openStudentCalendar(student) {
    const latestRecord = [...(student.attendanceCalendar ?? [])]
      .sort(
        (left, right) =>
          new Date(right.recordedAt ?? right.date) -
          new Date(left.recordedAt ?? left.date)
      )[0];

    setSelectedStudentId(student.studentUserId);
    setCalendarMonth(
      latestRecord ? new Date(latestRecord.recordedAt ?? latestRecord.date) : new Date()
    );
  }

  function moveCalendarMonth(direction) {
    setCalendarMonth(
      (currentMonth) =>
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth() + direction,
          1
        )
    );
  }

  async function handleStudentSubmit(event) {
    event.preventDefault();

    if (!classId || !user) {
      return;
    }

    if (studentForm.password !== studentForm.confirmPassword) {
      setRosterStatus({
        loading: false,
        message: "Password and confirm password must match."
      });
      return;
    }

    setRosterStatus({ loading: true, message: "" });

    try {
      const response = editingStudentId
        ? await updateTeacherClassroomStudent(
            user.userId,
            classId,
            editingStudentId,
            studentForm
          )
        : await addTeacherClassroomStudent(user.userId, classId, studentForm);

      setClassroomData(response);
      setStudentForm(emptyStudentForm);
      setEditingStudentId("");
      setRosterStatus({
        loading: false,
        message: response.message ?? "Roster updated."
      });
    } catch (error) {
      setRosterStatus({
        loading: false,
        message:
          error instanceof Error ? error.message : "Unable to update roster."
      });
    }
  }

  async function handleDeleteStudent(student) {
    if (!classId || !user) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${student.studentName} from ${classroomData?.classroom?.subjectCode ?? "this class"}?`
    );

    if (!confirmed) {
      return;
    }

    setRosterStatus({ loading: true, message: "" });

    try {
      const response = await deleteTeacherClassroomStudent(
        user.userId,
        classId,
        student.studentUserId
      );

      setClassroomData(response);
      if (editingStudentId === student.studentUserId) {
        setStudentForm(emptyStudentForm);
        setEditingStudentId("");
      }
      setRosterStatus({
        loading: false,
        message: response.message ?? "Student removed from class."
      });
    } catch (error) {
      setRosterStatus({
        loading: false,
        message:
          error instanceof Error ? error.message : "Unable to remove student."
      });
    }
  }

  function updateLeaveReviewNote(requestId, value) {
    setLeaveReviewNotes((currentNotes) => ({
      ...currentNotes,
      [requestId]: value
    }));
    setLeaveReviewStatus({ pendingId: "", message: "" });
  }

  async function handleReviewLeaveRequest(requestId, nextStatus) {
    if (!classId || !user || !requestId) {
      return;
    }

    setLeaveReviewStatus({ pendingId: requestId, message: "" });

    try {
      const response = await reviewTeacherLeaveRequest(user.userId, classId, requestId, {
        status: nextStatus,
        teacherNote: leaveReviewNotes[requestId] ?? ""
      });

      await loadClassroom();
      setLeaveReviewStatus({
        pendingId: "",
        message: response.message ?? "Leave request reviewed."
      });
    } catch (error) {
      setLeaveReviewStatus({
        pendingId: "",
        message:
          error instanceof Error
            ? error.message
            : "Unable to review leave request."
      });
    }
  }

  if (!user || user.role !== "teacher") {
    return null;
  }

  if (pageStatus.loading) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard label="Loading" title="Preparing student details..." />
        </main>
      </div>
    );
  }

  if (!classroomData) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard
            label="Student Details Error"
            title={pageStatus.message || "Unable to load student details."}
            action={
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  goToRoute(`/teacher-classroom?classId=${encodeURIComponent(classId ?? "")}`)
                }
              >
                Back to Class
              </button>
            }
          />
        </main>
      </div>
    );
  }

  const { classroom, overview, roster } = classroomData;
  const enrolledCount = roster.length;
  const lowAttendanceCount = roster.filter(
    (student) => student.attendancePercentage < safeRange
  ).length;
  const safeAttendanceCount = roster.filter(
    (student) => student.attendancePercentage >= safeRange
  ).length;
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredStudents = roster
    .filter((student) => {
      const searchableText = [
        student.studentName,
        student.rollNumber,
        student.studentUserId,
        student.latestStatus
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesAttendanceFilter(student, activeFilter, safeRange) &&
        (!normalizedSearchTerm || searchableText.includes(normalizedSearchTerm))
      );
    })
    .sort((left, right) => {
      if (sortOption === "name") {
        return String(left.studentName).localeCompare(String(right.studentName));
      }

      if (sortOption === "attendance-asc") {
        return left.attendancePercentage - right.attendancePercentage;
      }

      if (sortOption === "attendance-desc") {
        return right.attendancePercentage - left.attendancePercentage;
      }

      return compareStudentsByRollNumber(left, right);
    });
  const selectedStudent = roster.find(
    (student) => student.studentUserId === selectedStudentId
  );
  const selectedAttendanceRecords = selectedStudent?.attendanceCalendar ?? [];
  const selectedRecordsByDate = new Map(
    selectedAttendanceRecords.map((record) => [record.date, record])
  );
  const selectedStatusCounts = getStatusCounts(selectedAttendanceRecords);
  const selectedLeaveRequests = selectedStudent?.leaveRequests ?? [];
  const selectedPendingLeaveCount = selectedLeaveRequests.filter(
    (request) => request.status === "pending"
  ).length;
  const calendarDays = getCalendarMonthDays(calendarMonth);

  function resetFilters() {
    setActiveFilter("all");
    setSearchTerm("");
    setSortOption("roll");
    setSafeRange(clampSafeRange(overview.lowAttendanceThreshold ?? 75));
  }

  function downloadFilteredStudents() {
    const header = ["Name", "Roll No", "Attendance Percentage", "Classes Attended"];
    const rows = filteredStudents.map((student) => [
      student.studentName,
      student.rollNumber || student.studentUserId,
      `${student.attendancePercentage}%`,
      `${student.sessionsAttended}/${student.sessionsHeld || 0}`
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filterName =
      attendanceFilters.find((filter) => filter.id === activeFilter)?.label ??
      "students";

    link.href = url;
    link.download = `${classroom.subjectCode}-${filterName
      .toLowerCase()
      .replace(/\s+/g, "-")}-students.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="dashboard-topbar glass-card">
        <AppBrand href="#/" subtitle="Teacher Student Details" />

        <nav className="dashboard-nav">
          <button
            className="dashboard-nav-button"
            type="button"
            onClick={() =>
              goToRoute(`/teacher-classroom?classId=${encodeURIComponent(classId)}`)
            }
          >
            Class Workspace
          </button>
          <button className="dashboard-nav-button active-teacher-nav" type="button">
            Student Details
          </button>
        </nav>

        <div className="dashboard-header-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              goToRoute(`/teacher-classroom?classId=${encodeURIComponent(classId)}`)
            }
          >
            Back to Class
          </button>
          <button className="primary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-shell">
        <section className="teacher-dashboard-greeting">
          <h1>Student Details</h1>
          <p className="course-meta">
            {classroom.subjectName} • {classroom.subjectCode}
          </p>
        </section>

        <section className="dashboard-profile-strip teacher-student-summary-strip">
          <div>
            <span>All Students</span>
            <strong>{enrolledCount}</strong>
          </div>
          <div>
            <span>Below Range</span>
            <strong>{lowAttendanceCount}</strong>
          </div>
          <div>
            <span>Above Range</span>
            <strong>{safeAttendanceCount}</strong>
          </div>
          <div>
            <span>Leave Requests</span>
            <strong>{classroomData.pendingLeaveRequests ?? 0}</strong>
          </div>
        </section>

        <section className="glass-card dashboard-panel teacher-roster-manager-panel">
          <div className="teacher-student-filter-topline">
            <div>
              <span className="pill">{editingStudentId ? "Edit Student" : "Add Student"}</span>
              <h2>{editingStudentId ? "Update roster details" : "Add a student to this class"}</h2>
            </div>
            {editingStudentId ? (
              <button className="secondary-button" type="button" onClick={resetStudentForm}>
                Cancel Edit
              </button>
            ) : null}
          </div>

          <form className="teacher-roster-form" onSubmit={handleStudentSubmit}>
            <div className="teacher-roster-form-grid">
              <label className="field">
                <span>Student ID</span>
                <input
                  type="text"
                  value={studentForm.userId}
                  onChange={(event) => updateStudentForm("userId", event.target.value)}
                  placeholder="STU-1001"
                  disabled={Boolean(editingStudentId)}
                  required
                />
              </label>
              <label className="field">
                <span>First name</span>
                <input
                  type="text"
                  value={studentForm.firstName}
                  onChange={(event) => updateStudentForm("firstName", event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Last name</span>
                <input
                  type="text"
                  value={studentForm.lastName}
                  onChange={(event) => updateStudentForm("lastName", event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Roll number</span>
                <input
                  type="text"
                  value={studentForm.rollNumber}
                  onChange={(event) => updateStudentForm("rollNumber", event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={studentForm.email}
                  onChange={(event) => updateStudentForm("email", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Department</span>
                <input
                  type="text"
                  value={studentForm.department}
                  onChange={(event) => updateStudentForm("department", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Batch</span>
                <input
                  type="text"
                  value={studentForm.batch}
                  onChange={(event) => updateStudentForm("batch", event.target.value)}
                />
              </label>
              <label className="field">
                <span>{editingStudentId ? "New account password" : "Account password"}</span>
                <input
                  type="password"
                  value={studentForm.password}
                  onChange={(event) => updateStudentForm("password", event.target.value)}
                  className={hasStudentPasswordMismatch ? "input-error" : undefined}
                  placeholder={editingStudentId ? "Leave blank to keep current" : "Enter password"}
                  required={!editingStudentId}
                  autoComplete="new-password"
                />
              </label>
              <label className="field">
                <span>
                  {editingStudentId ? "Confirm new password" : "Confirm account password"}
                </span>
                <input
                  type="password"
                  value={studentForm.confirmPassword}
                  onChange={(event) =>
                    updateStudentForm("confirmPassword", event.target.value)
                  }
                  className={hasStudentPasswordMismatch ? "input-error" : undefined}
                  placeholder={
                    editingStudentId ? "Repeat only if changing password" : "Enter password again"
                  }
                  required={!editingStudentId}
                  autoComplete="new-password"
                />
              </label>
            </div>

            <div className="teacher-roster-actions">
              <button className="primary-button" type="submit" disabled={rosterStatus.loading}>
                {rosterStatus.loading
                  ? "Saving..."
                  : editingStudentId
                    ? "Save Student"
                    : "Add Student"}
              </button>
              <button className="secondary-button" type="button" onClick={resetStudentForm}>
                Clear
              </button>
              {rosterStatus.message ? (
                <span className="panel-meta">{rosterStatus.message}</span>
              ) : null}
            </div>
          </form>
        </section>

        <section className="glass-card dashboard-panel teacher-student-filter-panel">
          <div className="teacher-student-filter-topline">
            <div>
              <span className="pill">Filters</span>
              <h2>Student roster</h2>
            </div>
            <button className="secondary-button" type="button" onClick={resetFilters}>
              Reset
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={downloadFilteredStudents}
              disabled={!filteredStudents.length}
            >
              Download Names
            </button>
          </div>

          <div className="teacher-student-control-grid">
            <label className="field teacher-search-control">
              <span>Search Students</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Name, roll number, or student ID"
              />
            </label>

            <label className="teacher-safe-range-control">
              <span>Safe Attendance Range</span>
              <div className="teacher-safe-range-inputs">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={safeRange}
                  onChange={(event) => setSafeRange(clampSafeRange(event.target.value))}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={safeRange}
                  onChange={(event) => setSafeRange(clampSafeRange(event.target.value))}
                />
                <strong>%</strong>
              </div>
            </label>

            <label className="teacher-sort-control">
              <span>Sort Students</span>
              <select
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value)}
              >
                {attendanceSortOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="teacher-student-filter-groups">
            <div className="teacher-student-filter-group">
              <span className="teacher-filter-label">Attendance</span>
              <div className="teacher-student-filter-row">
                {attendanceFilters.map((filter) => (
                  <button
                    key={filter.id}
                    className={`role-tab ${activeFilter === filter.id ? "active" : ""}`}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                  >
                    {filter.label}
                    <span>{getAttendanceFilterCount(roster, filter.id, safeRange)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="teacher-student-result-bar">
            <strong>{filteredStudents.length}</strong>
            <span>of {enrolledCount} students shown</span>
          </div>

          {selectedStudent ? (
            <section className="teacher-student-calendar-panel">
              <div className="teacher-student-calendar-header">
                <div>
                  <span className="pill">Student Calendar</span>
                  <h3>{selectedStudent.studentName}</h3>
                  <p>
                    Roll No {selectedStudent.rollNumber || selectedStudent.studentUserId} •{" "}
                    {selectedStudent.attendancePercentage}% attendance
                  </p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setSelectedStudentId("")}
                >
                  Close
                </button>
              </div>

              <div className="teacher-student-calendar-stats">
                <div>
                  <span>Present</span>
                  <strong>{selectedStatusCounts.present}</strong>
                </div>
                <div>
                  <span>Absent</span>
                  <strong>{selectedStatusCounts.absent}</strong>
                </div>
                <div>
                  <span>Cancelled</span>
                  <strong>{selectedStatusCounts.cancelled}</strong>
                </div>
                <div>
                  <span>Sessions Counted</span>
                  <strong>{selectedStudent.sessionsHeld || 0}</strong>
                </div>
              </div>

              <div className="teacher-calendar-toolbar">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => moveCalendarMonth(-1)}
                >
                  Previous
                </button>
                <strong>{getMonthLabel(calendarMonth)}</strong>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => moveCalendarMonth(1)}
                >
                  Next
                </button>
              </div>

              <div className="teacher-student-calendar-grid">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <span key={day} className="teacher-calendar-weekday">
                    {day}
                  </span>
                ))}
                {calendarDays.map((day) => {
                  const record = day.empty ? null : selectedRecordsByDate.get(day.key);
                  const status = record?.status ?? "none";

                  return (
                    <div
                      key={day.key}
                      className={`teacher-calendar-day ${day.empty ? "empty" : status}`}
                      title={record ? `${record.statusLabel} • ${record.notes || "No note"}` : ""}
                    >
                      {day.empty ? null : (
                        <>
                          <strong>{day.label}</strong>
                          <span>
                            {record
                              ? record.status === "cancelled"
                                ? "Cancelled"
                                : record.statusLabel
                              : ""}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="teacher-calendar-legend">
                <span className="present">Present</span>
                <span className="absent">Absent</span>
                <span className="cancelled">Cancelled</span>
                <span className="none">No record</span>
              </div>

              <div className="teacher-leave-review-panel">
                <div className="teacher-student-calendar-header">
                  <div>
                    <span className="pill">Leave Proof</span>
                    <h3>
                      {selectedPendingLeaveCount
                        ? `${selectedPendingLeaveCount} pending request${selectedPendingLeaveCount === 1 ? "" : "s"}`
                        : "No pending leave requests"}
                    </h3>
                    <p>Review medical reports, leave proof, and absence reasons inline.</p>
                  </div>
                </div>

                {leaveReviewStatus.message ? (
                  <p className="teacher-leave-review-message">
                    {leaveReviewStatus.message}
                  </p>
                ) : null}

                <div className="teacher-leave-request-list">
                  {selectedLeaveRequests.length ? (
                    selectedLeaveRequests.map((request) => (
                      <article
                        key={request.id}
                        className={`teacher-leave-request-card ${request.status}`}
                      >
                        <div className="teacher-leave-request-head">
                          <div>
                            <strong>{formatDateLabel(request.absenceDate)}</strong>
                            <span>
                              {request.requestType} • Submitted{" "}
                              {formatDateLabel(request.submittedAt)}
                            </span>
                          </div>
                          <span className={`leave-status-pill ${request.status}`}>
                            {request.status}
                          </span>
                        </div>

                        <p>{request.reason}</p>

                        <div className="teacher-leave-proof-grid">
                          {(request.attachments ?? []).map((attachment) => (
                            <ProofPreview
                              key={`${request.id}-${attachment.fileName}`}
                              attachment={attachment}
                            />
                          ))}
                        </div>

                        <label className="field teacher-leave-note-field">
                          <span>Teacher note</span>
                          <textarea
                            value={
                              leaveReviewNotes[request.id] ?? request.teacherNote ?? ""
                            }
                            onChange={(event) =>
                              updateLeaveReviewNote(request.id, event.target.value)
                            }
                            rows="2"
                            placeholder="Optional note for the student."
                          />
                        </label>

                        <div className="teacher-student-row-actions">
                          <button
                            className="primary-button"
                            type="button"
                            disabled={leaveReviewStatus.pendingId === request.id}
                            onClick={() => handleReviewLeaveRequest(request.id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            className="ghost-button danger-action"
                            type="button"
                            disabled={leaveReviewStatus.pendingId === request.id}
                            onClick={() => handleReviewLeaveRequest(request.id, "rejected")}
                          >
                            Reject
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="panel-fallback">
                      This student has not submitted leave proof for this class.
                    </p>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          <div className="teacher-student-list">
            {filteredStudents.length ? (
              filteredStudents.map((student) => (
                <div key={student.studentUserId} className="teacher-student-row">
                  <div className="teacher-student-profile">
                    <div className="teacher-student-avatar">
                      {getInitials(student.studentName)}
                    </div>
                    <div className="teacher-student-identity">
                      <strong>{student.studentName}</strong>
                      <span>Roll No {student.rollNumber || student.studentUserId}</span>
                    </div>
                  </div>

                  <div className="teacher-student-attendance-metric">
                    <strong>{student.attendancePercentage}%</strong>
                    <div className="teacher-attendance-meter" aria-hidden="true">
                      <span
                        style={{
                          width: `${getClampedPercentage(student.attendancePercentage)}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="teacher-student-classes-count">
                    <strong>{student.sessionsAttended}/{student.sessionsHeld || 0}</strong>
                    <span>classes</span>
                  </div>

                  <span
                    className={`teacher-range-pill ${
                      student.attendancePercentage < safeRange ? "low" : "high"
                    }`}
                  >
                    {student.attendancePercentage < safeRange ? "Below Range" : "Above Range"}
                  </span>

                  <span
                    className={`teacher-range-pill ${
                      (student.leaveRequests ?? []).some(
                        (request) => request.status === "pending"
                      )
                        ? "pending"
                        : "high"
                    }`}
                  >
                    {(student.leaveRequests ?? []).filter(
                      (request) => request.status === "pending"
                    ).length}{" "}
                    Leave
                  </span>

                  <div className="teacher-student-row-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => openStudentCalendar(student)}
                    >
                      Open
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => startEditingStudent(student)}
                    >
                      Edit
                    </button>
                    <button
                      className="ghost-button danger-action"
                      type="button"
                      onClick={() => handleDeleteStudent(student)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="panel-fallback">
                No students match this attendance filter right now.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
