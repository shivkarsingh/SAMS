import { useEffect, useMemo, useRef, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  fetchTeacherClassroom,
  finalizeTeacherAttendance,
  processTeacherAttendance
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { convertFilesToImagesPayload } from "../../utils/fileReaders";
import { getHashSearchParam, goToRoute } from "../../utils/router";
import "../TeacherDashboardPage/TeacherDashboardPage.css";
import "../TeacherDashboardPage/components/TeacherClassCreationSection.css";
import "./TeacherClassroomPage.css";

const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

const initialAttendanceDraft = {
  acceptedSuggestedTrackIds: [],
  confirmedReviewPersonIds: [],
  manuallyAddedPresentIds: [],
  notes: ""
};

export function TeacherClassroomPage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const classId = getHashSearchParam("classId");
  const [classroomData, setClassroomData] = useState(null);
  const [pageStatus, setPageStatus] = useState({
    loading: true,
    message: ""
  });
  const [captureFiles, setCaptureFiles] = useState([]);
  const [capturedImages, setCapturedImages] = useState([]);
  const [camera, setCamera] = useState({
    open: false,
    pending: false
  });
  const [captureStatus, setCaptureStatus] = useState({
    pending: false,
    tone: "",
    message: ""
  });
  const [attendanceSession, setAttendanceSession] = useState(null);
  const [attendanceDraft, setAttendanceDraft] = useState(initialAttendanceDraft);
  const [finalizedAttendance, setFinalizedAttendance] = useState(null);
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!camera.open || !streamRef.current || !videoRef.current) {
      return;
    }

    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {});
  }, [camera.open]);

  useEffect(() => () => {
    stopCameraStream();
  }, []);

  useEffect(() => {
    if (!user || user.role !== "teacher") {
      goToRoute("/login");
      return;
    }

    if (!classId) {
      setPageStatus({
        loading: false,
        message: "A classroom ID is required to open this page."
      });
      return;
    }

    async function loadClassroom() {
      try {
        const response = await fetchTeacherClassroom(user.userId, classId);
        setClassroomData(response);
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
              : "Unable to load classroom details."
        });
      }
    }

    void loadClassroom();
  }, [classId, user]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
  }

  function stopCameraStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function resetAttendanceDraft(sessionRecord) {
    setAttendanceDraft({
      acceptedSuggestedTrackIds: sessionRecord.recognizedStudents
        .filter((student) => student.status === "present-suggested")
        .map((student) => student.trackId),
      confirmedReviewPersonIds: [],
      manuallyAddedPresentIds: [],
      notes: ""
    });
  }

  function resetCaptureSelection() {
    setCaptureFiles([]);
    setCapturedImages([]);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function closeCamera() {
    stopCameraStream();
    setCamera({
      open: false,
      pending: false
    });
  }

  async function handleCameraToggle() {
    if (camera.open) {
      closeCamera();
      return;
    }

    if (!window.isSecureContext) {
      const suggestedUrl = `http://localhost:${window.location.port || "5173"}`;

      setCaptureStatus({
        pending: false,
        tone: "warning",
        message: LOCALHOST_HOSTNAMES.has(window.location.hostname)
          ? "Chrome camera access needs a secure page. Reload this page and make sure camera permission is allowed."
          : `Chrome camera access only works here on localhost or HTTPS. Open the app at ${suggestedUrl} and try again.`
      });
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message:
          "Camera access is unavailable in this browser session. Open the app at http://localhost:5173 and check Chrome camera permissions."
      });
      return;
    }

    setCamera({
      open: false,
      pending: true
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment"
          }
        },
        audio: false
      });

      streamRef.current = stream;
      setCamera({
        open: true,
        pending: false
      });
    } catch (error) {
      closeCamera();
      let message = "Unable to open the camera.";

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          message =
            "Camera permission was blocked. Allow camera access for this site in Chrome and try again.";
        } else if (error.name === "NotFoundError") {
          message = "No camera was found on this device.";
        } else if (error.name === "NotReadableError") {
          message =
            "Chrome found the camera, but another app may already be using it. Close other camera apps and try again.";
        } else {
          message = `Unable to open the camera. ${error.message}`;
        }
      }

      setCaptureStatus({
        pending: false,
        tone: "warning",
        message
      });
    }
  }

  function updateArrayToggle(key, value) {
    setAttendanceDraft((currentDraft) => ({
      ...currentDraft,
      [key]: currentDraft[key].includes(value)
        ? currentDraft[key].filter((currentValue) => currentValue !== value)
        : [...currentDraft[key], value]
    }));
  }

  function handleFileChange(event) {
    setCaptureFiles(Array.from(event.target.files ?? []));
  }

  function handleCapturePhoto() {
    if (!videoRef.current?.videoWidth || !videoRef.current?.videoHeight) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message: "Wait for the camera preview to load before capturing."
      });
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message: "Unable to capture an image from the camera preview."
      });
      return;
    }

    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    setCapturedImages((currentImages) => [
      ...currentImages,
      {
        fileName: `classroom-capture-${currentImages.length + 1}.jpg`,
        dataUrl: canvas.toDataURL("image/jpeg", 0.92)
      }
    ]);
    setCaptureStatus({
      pending: false,
      tone: "success",
      message: `Camera capture added. ${captureFiles.length + capturedImages.length + 1} image(s) ready for attendance verification.`
    });
  }

  async function handleRunAttendance(event) {
    event.preventDefault();

    if (!captureFiles.length && !capturedImages.length) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message: "Upload at least one classroom capture image or take a camera capture to begin."
      });
      return;
    }

    setCaptureStatus({
      pending: true,
      tone: "",
      message: ""
    });

    try {
      const uploadedImages = await convertFilesToImagesPayload(captureFiles);
      const images = [...uploadedImages, ...capturedImages];
      const response = await processTeacherAttendance(user.userId, classId, {
        images
      });

      setAttendanceSession(response.session);
      resetAttendanceDraft(response.session);
      setFinalizedAttendance(null);
      setCaptureStatus({
        pending: false,
        tone: "success",
        message: `${response.message} ${response.captureImageCount} capture image(s) were analyzed.`
      });
    } catch (error) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Unable to run attendance verification."
      });
    }
  }

  async function handleFinalizeAttendance(event) {
    event.preventDefault();

    if (!attendanceSession) {
      return;
    }

    setCaptureStatus({
      pending: true,
      tone: "",
      message: ""
    });

    try {
      const rejectedTrackIds = attendanceSession.recognizedStudents
        .filter(
          (student) =>
            student.status === "present-suggested" &&
            !attendanceDraft.acceptedSuggestedTrackIds.includes(student.trackId)
        )
        .map((student) => student.trackId);
      const response = await finalizeTeacherAttendance(user.userId, classId, {
        sessionId: attendanceSession.sessionId,
        confirmedPresentIds: attendanceDraft.confirmedReviewPersonIds,
        manuallyAddedPresentIds: attendanceDraft.manuallyAddedPresentIds,
        rejectedTrackIds,
        notes: attendanceDraft.notes
      });

      setClassroomData(response.classroomDetails);
      setFinalizedAttendance(response.finalizedAttendance);
      setAttendanceSession(null);
      setAttendanceDraft(initialAttendanceDraft);
      resetCaptureSelection();
      closeCamera();
      setCaptureStatus({
        pending: false,
        tone: "success",
        message: response.message
      });
    } catch (error) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Unable to submit attendance."
      });
    }
  }

  async function copyValue(value, successMessage) {
    try {
      await navigator.clipboard.writeText(value);
      setCaptureStatus({
        pending: false,
        tone: "success",
        message: successMessage
      });
    } catch {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message: "Unable to copy from this browser session."
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
          <LoadingCard
            label="Loading"
            title="Preparing the classroom workspace..."
          />
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
            label="Classroom Error"
            title={pageStatus.message || "Unable to load this classroom."}
            action={
              <button
                className="secondary-button"
                type="button"
                onClick={() => goToRoute("/teacher-dashboard")}
              >
                Back to Dashboard
              </button>
            }
          />
        </main>
      </div>
    );
  }

  const { classroom, overview, roster, attendanceHistory, attentionNotes } = classroomData;
  const totalCaptureImages = captureFiles.length + capturedImages.length;
  const selectedCaptureItems = [
    ...captureFiles.map((file) => ({
      key: `${file.name}-${file.size}`,
      label: file.name,
      source: "Upload"
    })),
    ...capturedImages.map((image, index) => ({
      key: `${image.fileName}-${index}`,
      label: image.fileName,
      source: "Camera"
    }))
  ];
  const suggestedStudents = attendanceSession?.recognizedStudents.filter(
    (student) => student.status === "present-suggested"
  ) ?? [];
  const acceptedSuggestedPersonIds = attendanceSession?.recognizedStudents
    .filter(
      (student) =>
        student.status === "present-suggested" &&
        attendanceDraft.acceptedSuggestedTrackIds.includes(student.trackId)
    )
    .map((student) => student.personId) ?? [];
  const currentPresentIds = new Set([
    ...acceptedSuggestedPersonIds,
    ...attendanceDraft.confirmedReviewPersonIds,
    ...attendanceDraft.manuallyAddedPresentIds
  ]);
  const currentAbsentCount = attendanceSession
    ? Math.max(0, roster.length - currentPresentIds.size)
    : 0;
  const attendanceReviewMetrics = attendanceSession
    ? [
        {
          label: "Detected Faces",
          value: attendanceSession.detectedFaceCount
        },
        {
          label: "Suggested Present",
          value: suggestedStudents.length
        },
        {
          label: "Needs Review",
          value: attendanceSession.reviewQueue.length
        },
        {
          label: "Absent Candidates",
          value: attendanceSession.absentStudents.length
        },
        {
          label: "Unknown Faces",
          value: attendanceSession.unknownDetections.length
        }
      ]
    : [];

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="dashboard-topbar glass-card">
        <AppBrand href="#/" subtitle="Teacher Classroom Workspace" />

        <nav className="dashboard-nav">
          <button
            className="dashboard-nav-button"
            type="button"
            onClick={() => goToRoute("/teacher-dashboard")}
          >
            Dashboard
          </button>
          <button className="dashboard-nav-button active-teacher-nav" type="button">
            Class Workspace
          </button>
        </nav>

        <div className="dashboard-header-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => goToRoute("/teacher-dashboard")}
          >
            Back to Dashboard
          </button>
          <button className="primary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-shell">
        <section className="teacher-classroom-hero">
          <article className="glass-card teacher-classroom-intro">
            <div className="dashboard-kicker-row">
              <span className="pill">Class Workspace</span>
              <span
                className={`teacher-status-pill ${
                  classroom.attendanceSubmitted ? "submitted" : "pending"
                }`}
              >
                {classroom.attendanceSubmitted ? "Attendance Active" : "No Attendance Yet"}
              </span>
            </div>

            <h1>{classroom.subjectName}</h1>
            <p>
              {classroom.subjectCode} • {classroom.section} • {classroom.room || "Room pending"}
            </p>
            <p className="teacher-classroom-description">
              {classroom.description ||
                "Use this page to monitor roster readiness, verify classroom captures, and finalize attendance with review-first controls."}
            </p>

            <div className="dashboard-profile-strip teacher-classroom-strip">
              <div>
                <span>Students Joined</span>
                <strong>{overview.studentsCount}</strong>
              </div>
              <div>
                <span>Face Profiles Ready</span>
                <strong>{overview.readyFaceProfiles}</strong>
              </div>
              <div>
                <span>Average Attendance</span>
                <strong>{overview.averageAttendance}%</strong>
              </div>
              <div>
                <span>Sessions Finalized</span>
                <strong>{overview.totalSessions}</strong>
              </div>
            </div>

            <div className="teacher-class-actions" style={{ marginTop: "20px" }}>
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  copyValue(
                    classroom.joinCode,
                    `Join code ${classroom.joinCode} copied to clipboard.`
                  )
                }
              >
                Copy Join Code
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() =>
                  copyValue(
                    classroom.joinLink,
                    `Join link for ${classroom.subjectCode} copied to clipboard.`
                  )
                }
              >
                Copy Join Link
              </button>
            </div>
          </article>

          <article className="glass-card dashboard-panel">
            <div className="simple-list">
              {attentionNotes.map((note) => (
                <div key={note} className="simple-list-item">
                  <strong>Class Note</strong>
                  <span>{note}</span>
                </div>
              ))}
            </div>

            <div className="teacher-class-history">
              <h3>Recent Attendance Sessions</h3>
              {attendanceHistory.length ? (
                attendanceHistory.map((session) => (
                  <article key={session.sessionId} className="timeline-card">
                    <div className="timeline-time">
                      <span>Recorded</span>
                      <strong>{formatDateTime(session.recordedAt)}</strong>
                    </div>
                    <div className="timeline-content">
                      <strong>
                        {session.presentCount} present • {session.absentCount} absent
                      </strong>
                    </div>
                  </article>
                ))
              ) : (
                <p className="panel-fallback">
                  Finalized attendance sessions will appear here after the first submission.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="dashboard-main-grid teacher-classroom-main">
          <article className="glass-card dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <span className="pill">Roster</span>
                <h2>Students synced from the join flow.</h2>
                <p className="dashboard-panel-copy">
                  The class roster, face-profile readiness, and attendance percentages are all pulled from the same data used by student dashboards.
                </p>
              </div>
            </div>

            <div className="teacher-roster-grid">
              {roster.length ? (
                roster.map((student) => (
                  <article
                    key={student.studentUserId}
                    className="teacher-roster-card"
                  >
                    <div className="teacher-roster-header">
                      <div>
                        <h3>{student.studentName}</h3>
                        <span>{student.studentUserId}</span>
                      </div>
                      <span
                        className={`teacher-status-pill ${
                          student.faceProfileStatus === "enrolled"
                            ? "submitted"
                            : "pending"
                        }`}
                      >
                        {student.faceProfileStatus === "enrolled"
                          ? "Face Ready"
                          : "Needs Face Setup"}
                      </span>
                    </div>

                    <div className="teacher-share-grid">
                      <div>
                        <span>Attendance</span>
                        <strong>{student.attendancePercentage}%</strong>
                      </div>
                      <div>
                        <span>Sessions</span>
                        <strong>
                          {student.sessionsAttended}/{student.sessionsHeld}
                        </strong>
                      </div>
                      <div>
                        <span>Latest Status</span>
                        <strong>{student.latestStatus}</strong>
                      </div>
                    </div>

                    <p className="course-meta">
                      {student.department || classroom.batch || "Batch pending"} • Joined{" "}
                      {formatDateTime(student.joinedAt)}
                    </p>
                  </article>
                ))
              ) : (
                <p className="panel-fallback">
                  No students have joined this class yet. Share the invite link or code first.
                </p>
              )}
            </div>
          </article>

          <article className="glass-card dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <span className="pill">Take Attendance</span>
                <h2>Verify the class, review low scores, and submit once.</h2>
                <p className="dashboard-panel-copy">
                  Upload one or more classroom capture images. Suggested matches start as present, low-confidence matches stay in review, and absentees remain open for manual correction before final submission.
                </p>
              </div>
            </div>

            <form className="face-enrollment-form" onSubmit={handleRunAttendance}>
              <label className="field">
                <span>Classroom capture images</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={captureStatus.pending}
                  onChange={handleFileChange}
                />
              </label>

              <div className="teacher-class-actions">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={captureStatus.pending}
                >
                  {captureStatus.pending ? "Analyzing..." : "Run Attendance Verification"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={captureStatus.pending || camera.pending}
                  onClick={handleCameraToggle}
                >
                  {camera.pending
                    ? "Opening Camera..."
                    : camera.open
                      ? "Close Camera"
                      : "Use Camera"}
                </button>
                <span className="panel-meta">
                  Capture the room clearly so the AI can propose present students, review items, and absentees from the active roster.
                </span>
              </div>

              {captureStatus.message ? (
                <p className={`teacher-status-copy ${captureStatus.tone}`}>
                  {captureStatus.message}
                </p>
                ) : null}
            </form>

            {camera.open ? (
              <div className="teacher-camera-card">
                <video
                  ref={videoRef}
                  className="teacher-camera-preview"
                  autoPlay
                  muted
                  playsInline
                />
                <div className="teacher-class-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={handleCapturePhoto}
                  >
                    Capture Classroom Photo
                  </button>
                  <span className="panel-meta">
                    Current selection: {totalCaptureImages} image(s). Use wide classroom shots so more students are visible.
                  </span>
                </div>
              </div>
            ) : null}

            {selectedCaptureItems.length ? (
              <div className="selected-file-list">
                {selectedCaptureItems.map((item) => (
                  <span key={item.key} className="selected-file-pill">
                    <span>{item.label}</span>
                    <small className="selected-file-source">{item.source}</small>
                  </span>
                ))}
              </div>
            ) : null}

            {attendanceSession ? (
              <form className="teacher-attendance-review" onSubmit={handleFinalizeAttendance}>
                <div className="teacher-session-summary-grid">
                  {attendanceReviewMetrics.map((metric) => (
                    <article key={metric.label} className="teacher-session-summary-card">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </article>
                  ))}
                </div>

                {attendanceSession.notes.length ? (
                  <div className="simple-list teacher-session-notes">
                    {attendanceSession.notes.map((note) => (
                      <div key={note} className="simple-list-item">
                        <strong>Verification Note</strong>
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="teacher-review-group">
                  <h3>Suggested Present</h3>
                  {suggestedStudents.length ? (
                    suggestedStudents.map((student) => (
                      <label key={student.trackId} className="teacher-review-card">
                        <input
                          type="checkbox"
                          checked={attendanceDraft.acceptedSuggestedTrackIds.includes(
                            student.trackId
                          )}
                          onChange={() =>
                            updateArrayToggle(
                              "acceptedSuggestedTrackIds",
                              student.trackId
                            )
                          }
                        />
                        <div>
                          <strong>{student.fullName}</strong>
                          <span>
                            {student.personId} • Confidence {Math.round(student.confidence * 100)}%
                          </span>
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="panel-fallback">
                      No automatic present matches were suggested from this capture.
                    </p>
                  )}
                </div>

                <div className="teacher-review-group">
                  <h3>Low-Confidence Review</h3>
                  {attendanceSession.reviewQueue.length ? (
                    attendanceSession.reviewQueue.map((student) => (
                      <label key={student.trackId} className="teacher-review-card">
                        <input
                          type="checkbox"
                          disabled={!student.personId}
                          checked={attendanceDraft.confirmedReviewPersonIds.includes(
                            student.personId
                          )}
                          onChange={() =>
                            updateArrayToggle(
                              "confirmedReviewPersonIds",
                              student.personId
                            )
                          }
                        />
                        <div>
                          <strong>{student.fullName ?? "Unknown roster match"}</strong>
                          <span>
                            {student.personId ?? "No roster ID"} • Confidence{" "}
                            {Math.round(student.confidence * 100)}%
                          </span>
                          <span>{student.reasons.join(" • ")}</span>
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="panel-fallback">
                      No low-confidence roster matches require review for this session.
                    </p>
                  )}
                </div>

                <div className="teacher-review-group">
                  <h3>Absent or Manual Corrections</h3>
                  {attendanceSession.absentStudents.length ? (
                    attendanceSession.absentStudents.map((student) => (
                      <label key={student.personId} className="teacher-review-card">
                        <input
                          type="checkbox"
                          checked={attendanceDraft.manuallyAddedPresentIds.includes(
                            student.personId
                          )}
                          onChange={() =>
                            updateArrayToggle(
                              "manuallyAddedPresentIds",
                              student.personId
                            )
                          }
                        />
                        <div>
                          <strong>{student.fullName}</strong>
                          <span>{student.personId}</span>
                          <span>{student.reason}</span>
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="panel-fallback">
                      No absentees were produced from this verification session.
                    </p>
                  )}
                </div>

                <div className="teacher-review-group">
                  <h3>Unknown Detections</h3>
                  {attendanceSession.unknownDetections.length ? (
                    attendanceSession.unknownDetections.map((detection) => (
                      <article
                        key={detection.trackId}
                        className="teacher-review-card unknown-review-card"
                      >
                        <div>
                          <strong>{detection.trackId}</strong>
                          <span>
                            Confidence {Math.round(detection.confidence * 100)}%
                          </span>
                          <span>{detection.reasons.join(" • ")}</span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="panel-fallback">
                      No unmatched faces were detected in this capture.
                    </p>
                  )}
                </div>

                <label className="field">
                  <span>Attendance note</span>
                  <textarea
                    value={attendanceDraft.notes}
                    onChange={(event) =>
                      setAttendanceDraft((currentDraft) => ({
                        ...currentDraft,
                        notes: event.target.value
                      }))
                    }
                    rows="3"
                    placeholder="Add anything useful about this attendance session."
                  />
                </label>

                <div className="teacher-class-actions">
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={captureStatus.pending}
                  >
                    {captureStatus.pending ? "Submitting..." : "Submit Attendance"}
                  </button>
                  <span className="panel-meta">
                    Current submission will mark {currentPresentIds.size} present and{" "}
                    {currentAbsentCount} absent. Finalization writes the session to the backend so both teacher and student dashboards stay in sync.
                  </span>
                </div>
              </form>
            ) : null}

            {finalizedAttendance ? (
              <article className="alert-card positive teacher-finalized-card">
                <h3>Attendance Submitted</h3>
                <p>
                  {finalizedAttendance.totalPresent} present •{" "}
                  {finalizedAttendance.totalAbsent} absent • Finalized{" "}
                  {formatDateTime(finalizedAttendance.finalizedAt)}
                </p>
              </article>
            ) : null}
          </article>
        </section>
      </main>
    </div>
  );
}
