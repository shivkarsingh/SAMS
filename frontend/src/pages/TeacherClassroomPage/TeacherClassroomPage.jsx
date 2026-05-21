import { useEffect, useMemo, useRef, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  archiveTeacherClass,
  cancelTodayClass,
  deleteTeacherClass,
  discardTodayAttendanceDraft,
  fetchTeacherClassroom,
  finalizeTodayAttendanceDraft,
  finalizeTeacherAttendance,
  processTeacherAttendance,
  sendAttendanceAbsenteeEmails,
  sendTodayDraftAbsenteeEmails,
  submitManualAttendance,
  updateTodayAttendanceDraft
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

function getConfidenceTone(confidence) {
  const numericConfidence = Number(confidence);

  if (!Number.isFinite(numericConfidence)) {
    return "unavailable";
  }

  if (numericConfidence >= 0.85) {
    return "high";
  }

  if (numericConfidence >= 0.6) {
    return "medium";
  }

  return "low";
}

function formatConfidencePercent(confidence) {
  const numericConfidence = Number(confidence);

  if (!Number.isFinite(numericConfidence)) {
    return 0;
  }

  return Math.round(Math.max(0, Math.min(1, numericConfidence)) * 100);
}

function formatConfidenceLabel(confidence) {
  const numericConfidence = Number(confidence);

  if (!Number.isFinite(numericConfidence)) {
    return "N/A";
  }

  return `${formatConfidencePercent(numericConfidence)}%`;
}

function getInitials(name) {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "?";
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function resolveStudentPhotoUrl(student, rosterStudent = null) {
  return (
    student?.profilePhotoUrl ||
    student?.avatarDataUrl ||
    student?.faceProfilePhotoUrl ||
    student?.avatarUrl ||
    student?.photoUrl ||
    rosterStudent?.profilePhotoUrl ||
    rosterStudent?.avatarDataUrl ||
    rosterStudent?.faceProfilePhotoUrl ||
    rosterStudent?.avatarUrl ||
    rosterStudent?.photoUrl ||
    ""
  );
}

function StudentReviewAvatar({ student, rosterStudent = null, name }) {
  const [imageFailed, setImageFailed] = useState(false);
  const profilePhotoUrl = resolveStudentPhotoUrl(student, rosterStudent);

  useEffect(() => {
    setImageFailed(false);
  }, [profilePhotoUrl]);

  return (
    <div className="teacher-review-avatar" aria-hidden="true">
      {profilePhotoUrl && !imageFailed ? (
        <img src={profilePhotoUrl} alt="" onError={() => setImageFailed(true)} />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}

function normalizePersonId(personId) {
  return String(personId ?? "").trim().toUpperCase();
}

const noisyVerificationNotePrefixes = [
  "classroom capture processed successfully",
  "recognition is restricted to the roster sent with this class session",
  "a single classroom image was provided",
  "classroom recognition used real insightface"
];

function getRelevantVerificationNotes(notes) {
  const seenNotes = new Set();

  return (notes ?? [])
    .map((note) => String(note ?? "").trim())
    .filter(Boolean)
    .filter((note) => {
      const normalizedNote = note.toLowerCase();

      return !noisyVerificationNotePrefixes.some((prefix) =>
        normalizedNote.startsWith(prefix)
      );
    })
    .filter((note) => {
      if (seenNotes.has(note)) {
        return false;
      }

      seenNotes.add(note);
      return true;
    });
}

function getLocalDateKey(value = new Date()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildManualStatuses(roster, forcedStatus = "") {
  const todayKey = getLocalDateKey();

  return Object.fromEntries(
    roster.map((student) => {
      const todayRecord = (student.attendanceCalendar ?? [])
        .filter((record) => record.date === todayKey)
        .at(-1);
      const resolvedStatus =
        forcedStatus ||
        (todayRecord?.status === "present" || todayRecord?.status === "late"
          ? "present"
          : "absent");

      return [normalizePersonId(student.studentUserId), resolvedStatus];
    })
  );
}

function buildTodayDraftStatuses(draft) {
  return Object.fromEntries(
    (draft?.records ?? []).map((record) => [
      normalizePersonId(record.studentId),
      record.status === "late" ? "late" : record.status === "present" ? "present" : "absent"
    ])
  );
}

function summarizeAbsenteeNotifications(notifications) {
  if (
    notifications &&
    !Array.isArray(notifications) &&
    notifications.status === "failed"
  ) {
    return `Absentee email workflow failed: ${notifications.reason || "unknown error"}.`;
  }

  if (!Array.isArray(notifications) || notifications.length === 0) {
    return "No absentee email was needed for this run.";
  }

  const sentCount = notifications.filter((item) => item.status === "sent").length;
  const failedCount = notifications.filter((item) => item.status === "failed").length;
  const skippedCount = notifications.filter((item) => item.status === "skipped").length;
  const duplicateCount = notifications.filter(
    (item) => item.reason === "duplicate" || item.reason === "duplicate-in-flight"
  ).length;
  const smtpSkippedCount = notifications.filter((item) =>
    ["smtp-not-configured", "email-disabled"].includes(item.reason)
  ).length;
  const missingEmailCount = notifications.filter((item) =>
    ["missing-email", "missing-student-email"].includes(item.reason)
  ).length;

  if (failedCount) {
    return `${sentCount} absentee email(s) sent, ${failedCount} failed, and ${skippedCount} skipped.`;
  }

  if (sentCount) {
    return `${sentCount} absentee email(s) sent.`;
  }

  if (duplicateCount === skippedCount) {
    return "Absentees were already notified earlier today.";
  }

  if (smtpSkippedCount === skippedCount) {
    return "Absentee emails were logged but skipped because email delivery is not configured.";
  }

  if (missingEmailCount === skippedCount) {
    return "Absentee email notices were skipped because student email addresses are missing.";
  }

  return `${skippedCount} absentee email notice(s) were skipped.`;
}

function StudentReviewSummary({
  student,
  rosterStudent,
  statusLabel,
  statusTone,
  confidence,
  metaLabel = "Roll No",
  metaValue,
  children
}) {
  const displayName =
    student?.fullName || student?.studentName || rosterStudent?.studentName || "Unknown student";
  const resolvedMetaValue =
    metaValue || rosterStudent?.rollNumber || student?.rollNumber || student?.personId;

  return (
    <div className="teacher-review-student">
      <StudentReviewAvatar
        student={student}
        rosterStudent={rosterStudent}
        name={displayName}
      />

      <div className="teacher-review-student-main">
        <div className="teacher-review-student-header">
          <div className="teacher-review-student-name">
            <strong>{displayName}</strong>
            <span>
              {resolvedMetaValue ? `${metaLabel}: ${resolvedMetaValue}` : "Roll No: Not available"}
            </span>
          </div>
          <span className={`teacher-review-status-pill ${statusTone}`}>
            {statusLabel}
          </span>
        </div>

        <div className="teacher-review-student-facts">
          <span
            className={`teacher-confidence-pill ${getConfidenceTone(confidence)}`}
          >
            Confidence {formatConfidenceLabel(confidence)}
          </span>
          {student?.personId ? <span>ID: {student.personId}</span> : null}
        </div>

        {children ? (
          <div className="teacher-review-student-note">{children}</div>
        ) : null}
      </div>
    </div>
  );
}

const initialAttendanceDraft = {
  acceptedSuggestedTrackIds: [],
  confirmedReviewPersonIds: [],
  manuallyAddedPresentIds: [],
  attendanceUnit: "1",
  sessionType: "regular",
  notes: ""
};
const initialManualAttendance = {
  statuses: {},
  attendanceUnit: "1",
  sessionType: "regular",
  notes: "",
  pending: false,
  tone: "",
  message: ""
};
const initialTodayDraftUi = {
  statuses: {},
  attendanceUnit: "1",
  sessionType: "regular",
  notes: "",
  pending: false,
  retakePending: false,
  emailPending: false,
  tone: "",
  message: ""
};
const initialAttendanceEmailStatus = {
  pending: false,
  tone: "",
  message: ""
};
const initialAttendanceExport = {
  fromDate: "",
  toDate: "",
  message: ""
};
const MAX_CLASSROOM_CAPTURE_IMAGES = 4;
const CAPTURE_IMAGE_MAX_DIMENSION = 1600;
const CAPTURE_IMAGE_JPEG_QUALITY = 0.8;

export function TeacherClassroomPage({ attendanceOnly = false }) {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const classId = getHashSearchParam("classId");
  const [classroomData, setClassroomData] = useState(null);
  const [pageStatus, setPageStatus] = useState({
    loading: true,
    message: ""
  });
  const [uploadedCaptureImages, setUploadedCaptureImages] = useState([]);
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
  const [todayDraftUi, setTodayDraftUi] = useState(initialTodayDraftUi);
  const [manualAttendance, setManualAttendance] = useState(initialManualAttendance);
  const [manualAttendanceOpen, setManualAttendanceOpen] = useState(false);
  const [attendanceExport, setAttendanceExport] = useState(initialAttendanceExport);
  const [finalizedAttendance, setFinalizedAttendance] = useState(null);
  const [attendanceEmailStatus, setAttendanceEmailStatus] = useState(
    initialAttendanceEmailStatus
  );
  const [classArchiveStatus, setClassArchiveStatus] = useState({
    pending: false,
    message: ""
  });
  const [classDeleteStatus, setClassDeleteStatus] = useState({
    pending: false,
    message: ""
  });
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const todayDraftEmailRequestRef = useRef(false);
  const attendanceEmailRequestRef = useRef(false);

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
        setManualAttendance((currentAttendance) => ({
          ...currentAttendance,
          statuses: buildManualStatuses(response.roster ?? [])
        }));
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

  useEffect(() => {
    const draft = classroomData?.todayAttendanceDraft;

    if (!draft) {
      setTodayDraftUi(initialTodayDraftUi);
      return;
    }

    setTodayDraftUi((currentDraftUi) => ({
      ...currentDraftUi,
      statuses: buildTodayDraftStatuses(draft),
      attendanceUnit: String(draft.attendanceUnit ?? 1),
      sessionType: draft.sessionType === "extra" ? "extra" : "regular",
      notes: draft.notes ?? "",
      pending: false,
      retakePending: false,
      emailPending: false,
      tone: "",
      message: currentDraftUi.message
    }));
  }, [classroomData?.todayAttendanceDraft?.id]);

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
      attendanceUnit: "1",
      sessionType: "regular",
      notes: ""
    });
  }

  function resetCaptureSelection() {
    setUploadedCaptureImages([]);
    setCapturedImages([]);
    setAttendanceSession(null);

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
    if (!value) {
      return;
    }

    setAttendanceDraft((currentDraft) => ({
      ...currentDraft,
      [key]: currentDraft[key].includes(value)
        ? currentDraft[key].filter((currentValue) => currentValue !== value)
        : [...currentDraft[key], value]
    }));
  }

  function toggleConfirmedReviewPerson(personId) {
    if (!personId) {
      return;
    }

    setAttendanceDraft((currentDraft) => {
      const isCurrentlyConfirmed =
        currentDraft.confirmedReviewPersonIds.includes(personId);

      return {
        ...currentDraft,
        confirmedReviewPersonIds: isCurrentlyConfirmed
          ? currentDraft.confirmedReviewPersonIds.filter(
              (currentPersonId) => currentPersonId !== personId
            )
          : [...currentDraft.confirmedReviewPersonIds, personId],
        manuallyAddedPresentIds: isCurrentlyConfirmed
          ? currentDraft.manuallyAddedPresentIds
          : currentDraft.manuallyAddedPresentIds.filter(
              (currentPersonId) => currentPersonId !== personId
            )
      };
    });
  }

  function toggleManualPresentPerson(personId) {
    if (!personId) {
      return;
    }

    setAttendanceDraft((currentDraft) => {
      const isCurrentlyManual =
        currentDraft.manuallyAddedPresentIds.includes(personId);

      return {
        ...currentDraft,
        manuallyAddedPresentIds: isCurrentlyManual
          ? currentDraft.manuallyAddedPresentIds.filter(
              (currentPersonId) => currentPersonId !== personId
            )
          : [...currentDraft.manuallyAddedPresentIds, personId],
        confirmedReviewPersonIds: isCurrentlyManual
          ? currentDraft.confirmedReviewPersonIds
          : currentDraft.confirmedReviewPersonIds.filter(
              (currentPersonId) => currentPersonId !== personId
            )
      };
    });
  }

  async function handleFileChange(event) {
    const selectedFiles = Array.from(event.target.files ?? []);
    const validImageFiles = selectedFiles.filter((file) =>
      file.type.startsWith("image/")
    );
    const remainingSlots = Math.max(
      0,
      MAX_CLASSROOM_CAPTURE_IMAGES - capturedImages.length
    );
    const nextFiles = validImageFiles.slice(0, remainingSlots);

    setAttendanceSession(null);
    setFinalizedAttendance(null);

    if (selectedFiles.length !== validImageFiles.length) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message: "Only image files can be used for classroom attendance."
      });
      return;
    }

    if (validImageFiles.length > remainingSlots) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message: `Use up to ${MAX_CLASSROOM_CAPTURE_IMAGES} classroom images for one attendance run.`
      });
      return;
    }

    try {
      const nextImages = await convertFilesToImagesPayload(nextFiles);
      setUploadedCaptureImages(nextImages);
    } catch (error) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message:
          error instanceof Error ? error.message : "Unable to prepare selected images."
      });
      return;
    }

    setCaptureStatus({
      pending: false,
      tone: "",
      message: ""
    });
  }

  function handleCapturePhoto() {
    if (uploadedCaptureImages.length + capturedImages.length >= MAX_CLASSROOM_CAPTURE_IMAGES) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message: `Use up to ${MAX_CLASSROOM_CAPTURE_IMAGES} classroom images for one attendance run. Clear captures before adding more.`
      });
      return;
    }

    if (!videoRef.current?.videoWidth || !videoRef.current?.videoHeight) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message: "Wait for the camera preview to load before capturing."
      });
      return;
    }

    const scale = Math.min(
      1,
      CAPTURE_IMAGE_MAX_DIMENSION /
        Math.max(videoRef.current.videoWidth, videoRef.current.videoHeight)
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(videoRef.current.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(videoRef.current.videoHeight * scale));

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

    const nextImage = {
      fileName: `classroom-capture-${capturedImages.length + 1}.jpg`,
      dataUrl: canvas.toDataURL("image/jpeg", CAPTURE_IMAGE_JPEG_QUALITY)
    };

    setCapturedImages((currentImages) => [...currentImages, nextImage]);
    setAttendanceSession(null);
    setFinalizedAttendance(null);
    setCaptureStatus({
      pending: false,
      tone: "success",
      message: `Camera capture added. ${totalCaptureImages + 1} image(s) ready for attendance verification.`
    });
  }

  async function handleRunAttendance(event) {
    event.preventDefault();

    if (overview.readyFaceProfiles === 0) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message:
          "At least one student needs a current face enrollment before AI attendance can run for this class."
      });
      return;
    }

    if (!uploadedCaptureImages.length && !capturedImages.length) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message: "Upload at least one classroom capture image or take a camera capture to begin."
      });
      return;
    }

    if (
      uploadedCaptureImages.length + capturedImages.length >
      MAX_CLASSROOM_CAPTURE_IMAGES
    ) {
      setCaptureStatus({
        pending: false,
        tone: "warning",
        message: `Use up to ${MAX_CLASSROOM_CAPTURE_IMAGES} classroom images for one attendance run.`
      });
      return;
    }

    setCaptureStatus({
      pending: true,
      tone: "",
      message: ""
    });

    try {
      const images = [...uploadedCaptureImages, ...capturedImages];
      const response = await processTeacherAttendance(user.userId, classId, {
        images
      });

      if (response.classroomDetails) {
        setClassroomData(response.classroomDetails);
      }
      setAttendanceSession(response.session);
      resetAttendanceDraft(response.session);
      setFinalizedAttendance(null);
      setCaptureStatus({
        pending: false,
        tone: "success",
        message: `${response.message} ${response.captureImageCount} capture image(s) were analyzed. Today Attendance Data is ready. Use Send Email after review if absentees should be notified.`
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
        confirmedPresentIds: attendanceDraft.confirmedReviewPersonIds.filter(Boolean),
        manuallyAddedPresentIds: attendanceDraft.manuallyAddedPresentIds.filter(Boolean),
        rejectedTrackIds,
        attendanceUnit: attendanceDraft.attendanceUnit,
        sessionType: attendanceDraft.sessionType,
        notes: attendanceDraft.notes
      });

      setClassroomData(response.classroomDetails);
      setFinalizedAttendance(response.finalizedAttendance);
      setAttendanceEmailStatus(initialAttendanceEmailStatus);
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

  function updateManualStudentStatus(studentId, status) {
    setManualAttendance((currentAttendance) => ({
      ...currentAttendance,
      statuses: {
        ...currentAttendance.statuses,
        [normalizePersonId(studentId)]: status
      },
      message: ""
    }));
  }

  function markAllManual(status) {
    setManualAttendance((currentAttendance) => ({
      ...currentAttendance,
      statuses: buildManualStatuses(classroomData?.roster ?? [], status),
      message: ""
    }));
  }

  function updateManualNotes(notes) {
    setManualAttendance((currentAttendance) => ({
      ...currentAttendance,
      notes,
      message: ""
    }));
  }

  function updateManualAttendanceUnit(attendanceUnit) {
    setManualAttendance((currentAttendance) => ({
      ...currentAttendance,
      attendanceUnit,
      message: ""
    }));
  }

  function updateManualSessionType(isExtraClass) {
    setManualAttendance((currentAttendance) => ({
      ...currentAttendance,
      sessionType: isExtraClass ? "extra" : "regular",
      message: ""
    }));
  }

  function updateAttendanceExport(field, value) {
    setAttendanceExport((currentExport) => ({
      ...currentExport,
      [field]: value,
      message: ""
    }));
  }

  async function handleSubmitManualAttendance(event) {
    event.preventDefault();

    if (!classroomData?.roster?.length) {
      setManualAttendance((currentAttendance) => ({
        ...currentAttendance,
        tone: "warning",
        message: "Add students before submitting manual attendance."
      }));
      return;
    }

    setManualAttendance((currentAttendance) => ({
      ...currentAttendance,
      pending: true,
      tone: "",
      message: ""
    }));

    try {
      const response = await submitManualAttendance(user.userId, classId, {
        statuses: manualAttendance.statuses,
        attendanceUnit: manualAttendance.attendanceUnit,
        sessionType: manualAttendance.sessionType,
        notes: manualAttendance.notes
      });

      setClassroomData(response.classroomDetails);
      setFinalizedAttendance(response.finalizedAttendance);
      setAttendanceEmailStatus(initialAttendanceEmailStatus);
      setManualAttendance({
        ...initialManualAttendance,
        statuses: buildManualStatuses(response.classroomDetails?.roster ?? []),
        tone: "success",
        message: response.message
      });
    } catch (error) {
      setManualAttendance((currentAttendance) => ({
        ...currentAttendance,
        pending: false,
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Unable to submit manual attendance."
      }));
    }
  }

  function updateTodayDraftStudentStatus(studentId, status) {
    setTodayDraftUi((currentDraftUi) => ({
      ...currentDraftUi,
      statuses: {
        ...currentDraftUi.statuses,
        [normalizePersonId(studentId)]: status
      },
      message: ""
    }));
  }

  function updateTodayDraftNotes(notes) {
    setTodayDraftUi((currentDraftUi) => ({
      ...currentDraftUi,
      notes,
      message: ""
    }));
  }

  function updateTodayDraftAttendanceUnit(attendanceUnit) {
    setTodayDraftUi((currentDraftUi) => ({
      ...currentDraftUi,
      attendanceUnit,
      message: ""
    }));
  }

  function updateTodayDraftSessionType(isExtraClass) {
    setTodayDraftUi((currentDraftUi) => ({
      ...currentDraftUi,
      sessionType: isExtraClass ? "extra" : "regular",
      message: ""
    }));
  }

  async function handleSaveTodayDraft() {
    const draft = classroomData?.todayAttendanceDraft;

    if (!draft) {
      return;
    }

    setTodayDraftUi((currentDraftUi) => ({
      ...currentDraftUi,
      pending: true,
      tone: "",
      message: ""
    }));

    try {
      const response = await updateTodayAttendanceDraft(
        user.userId,
        classId,
        draft.id,
        {
          statuses: todayDraftUi.statuses,
          attendanceUnit: todayDraftUi.attendanceUnit,
          sessionType: todayDraftUi.sessionType,
          notes: todayDraftUi.notes
        }
      );

      setClassroomData(response.classroomDetails);
      setTodayDraftUi((currentDraftUi) => ({
        ...currentDraftUi,
        pending: false,
        tone: "success",
        message: response.message
      }));
    } catch (error) {
      setTodayDraftUi((currentDraftUi) => ({
        ...currentDraftUi,
        pending: false,
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save today attendance data."
      }));
    }
  }

  async function handleSendTodayDraftAbsenteeEmail() {
    const draft = classroomData?.todayAttendanceDraft;

    if (!draft || todayDraftEmailRequestRef.current) {
      return;
    }

    todayDraftEmailRequestRef.current = true;
    setTodayDraftUi((currentDraftUi) => ({
      ...currentDraftUi,
      emailPending: true,
      tone: "",
      message: "Sending absentee emails..."
    }));

    try {
      const response = await sendTodayDraftAbsenteeEmails(
        user.userId,
        classId,
        draft.id,
        {
          statuses: todayDraftUi.statuses,
          attendanceUnit: todayDraftUi.attendanceUnit,
          sessionType: todayDraftUi.sessionType,
          notes: todayDraftUi.notes
        }
      );

      setClassroomData(response.classroomDetails);
      setTodayDraftUi((currentDraftUi) => ({
        ...currentDraftUi,
        emailPending: false,
        tone: "success",
        message: summarizeAbsenteeNotifications(
          response.emailStatus?.absenteeNotifications
        )
      }));
    } catch (error) {
      setTodayDraftUi((currentDraftUi) => ({
        ...currentDraftUi,
        emailPending: false,
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Unable to send absentee emails."
      }));
    } finally {
      todayDraftEmailRequestRef.current = false;
    }
  }

  async function handleTakeAgainTodayDraft() {
    const draft = classroomData?.todayAttendanceDraft;

    if (!draft) {
      return;
    }

    setTodayDraftUi((currentDraftUi) => ({
      ...currentDraftUi,
      retakePending: true,
      tone: "",
      message: "Removing previous attendance verification..."
    }));

    try {
      const response = await discardTodayAttendanceDraft(
        user.userId,
        classId,
        draft.id
      );

      setClassroomData(response.classroomDetails);
      setAttendanceSession(null);
      setAttendanceDraft(initialAttendanceDraft);
      setFinalizedAttendance(null);
      setAttendanceEmailStatus(initialAttendanceEmailStatus);
      resetCaptureSelection();
      setTodayDraftUi({
        ...initialTodayDraftUi,
        tone: "success",
        message: response.message
      });
      setCaptureStatus({
        pending: false,
        tone: "success",
        message: "Previous verification removed. Add a new classroom capture to take attendance again."
      });
    } catch (error) {
      setTodayDraftUi((currentDraftUi) => ({
        ...currentDraftUi,
        retakePending: false,
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Unable to remove previous attendance verification."
      }));
    }
  }

  async function handleFinalizeTodayDraft() {
    const draft = classroomData?.todayAttendanceDraft;

    if (!draft) {
      return;
    }

    setTodayDraftUi((currentDraftUi) => ({
      ...currentDraftUi,
      pending: true,
      tone: "",
      message: ""
    }));

    try {
      const response = await finalizeTodayAttendanceDraft(
        user.userId,
        classId,
        draft.id,
        {
          statuses: todayDraftUi.statuses,
          attendanceUnit: todayDraftUi.attendanceUnit,
          sessionType: todayDraftUi.sessionType,
          notes: todayDraftUi.notes
        }
      );

      setClassroomData(response.classroomDetails);
      setFinalizedAttendance(response.finalizedAttendance);
      setAttendanceEmailStatus(initialAttendanceEmailStatus);
      setAttendanceSession(null);
      setAttendanceDraft(initialAttendanceDraft);
      resetCaptureSelection();
      closeCamera();
      setTodayDraftUi({
        ...initialTodayDraftUi,
        tone: "success",
        message: response.message
      });
      setCaptureStatus({
        pending: false,
        tone: "success",
        message: response.message
      });
    } catch (error) {
      setTodayDraftUi((currentDraftUi) => ({
        ...currentDraftUi,
        pending: false,
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Unable to finalize today attendance."
      }));
    }
  }

  async function handleSendFinalizedAbsenteeEmail() {
    if (!finalizedAttendance || attendanceEmailRequestRef.current) {
      return;
    }

    attendanceEmailRequestRef.current = true;
    setAttendanceEmailStatus({
      pending: true,
      tone: "",
      message: "Sending absentee emails..."
    });

    try {
      const response = await sendAttendanceAbsenteeEmails(user.userId, classId, {
        sessionId: finalizedAttendance.sessionId
      });

      if (response.classroomDetails) {
        setClassroomData(response.classroomDetails);
      }
      setAttendanceEmailStatus({
        pending: false,
        tone: "success",
        message: summarizeAbsenteeNotifications(
          response.emailStatus?.absentNotifications
        )
      });
    } catch (error) {
      setAttendanceEmailStatus({
        pending: false,
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Unable to send absentee emails."
      });
    } finally {
      attendanceEmailRequestRef.current = false;
    }
  }

  async function handleCancelTodayClass() {
    if (!classroomData?.roster?.length) {
      setManualAttendance((currentAttendance) => ({
        ...currentAttendance,
        tone: "warning",
        message: "Add students before cancelling today's class."
      }));
      return;
    }

    const reason = window.prompt(
      "Reason for cancelling today's class",
      "Class cancelled by teacher."
    );

    if (reason === null) {
      return;
    }

    setManualAttendance((currentAttendance) => ({
      ...currentAttendance,
      pending: true,
      tone: "",
      message: ""
    }));

    try {
      const response = await cancelTodayClass(user.userId, classId, {
        reason
      });

      setClassroomData(response.classroomDetails);
      setFinalizedAttendance(null);
      setManualAttendance({
        ...initialManualAttendance,
        statuses: buildManualStatuses(response.classroomDetails?.roster ?? []),
        tone: "success",
        message: response.message
      });
    } catch (error) {
      setManualAttendance((currentAttendance) => ({
        ...currentAttendance,
        pending: false,
        tone: "warning",
        message:
          error instanceof Error
            ? error.message
            : "Unable to cancel today's class."
      }));
    }
  }

  async function handleArchiveClassroom() {
    const currentClassroom = classroomData?.classroom;

    if (
      !currentClassroom ||
      currentClassroom.status === "archived" ||
      classDeleteStatus.pending
    ) {
      return;
    }

    const confirmed = window.confirm(
      `End ${currentClassroom.subjectCode} - ${currentClassroom.subjectName}? The class will become inactive, but attendance and student data will stay saved.`
    );

    if (!confirmed) {
      return;
    }

    setClassArchiveStatus({
      pending: true,
      message: ""
    });

    try {
      const response = await archiveTeacherClass(user.userId, classId);

      if (response.classroomDetails) {
        setClassroomData(response.classroomDetails);
      }

      setClassArchiveStatus({
        pending: false,
        message: response.message ?? "Class ended and saved."
      });
    } catch (error) {
      setClassArchiveStatus({
        pending: false,
        message:
          error instanceof Error ? error.message : "Unable to end this class."
      });
    }
  }

  async function handleDeleteClassroom() {
    const currentClassroom = classroomData?.classroom;

    if (!currentClassroom || classArchiveStatus.pending || classDeleteStatus.pending) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${currentClassroom.subjectCode} - ${currentClassroom.subjectName}? This permanently removes the class, roster, attendance, exams, assignments, discussions, and QR sessions. This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setClassDeleteStatus({
      pending: true,
      message: ""
    });

    try {
      const response = await deleteTeacherClass(user.userId, classId);

      window.alert(response.message ?? "Class deleted.");
      goToRoute("/teacher-dashboard");
    } catch (error) {
      setClassDeleteStatus({
        pending: false,
        message:
          error instanceof Error ? error.message : "Unable to delete this class."
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

  const { classroom, overview, roster, todayAttendance } = classroomData;
  const sortedRoster = roster.slice().sort(compareStudentsByRollNumber);
  const todayAttendanceDraft = classroomData.todayAttendanceDraft;
  const todayDraftRecords = (todayAttendanceDraft?.records ?? [])
    .map((record) => ({
      ...record,
      studentUserId: record.studentId,
      status:
        todayDraftUi.statuses[normalizePersonId(record.studentId)] ??
        record.status ??
        "absent"
    }))
    .sort(compareStudentsByRollNumber);
  const todayDraftPresentCount = todayDraftRecords.filter(
    (record) => record.status === "present" || record.status === "late"
  ).length;
  const todayDraftAbsentCount = Math.max(
    0,
    todayDraftRecords.length - todayDraftPresentCount
  );
  const todayDraftLateCount = todayDraftRecords.filter(
    (record) => record.status === "late"
  ).length;
  const todayDraftBusy =
    todayDraftUi.pending || todayDraftUi.retakePending || todayDraftUi.emailPending;
  const todayDraftRecordGroups = [
    {
      id: "present",
      title: "Present Students",
      emptyMessage: "No present students in this draft.",
      records: todayDraftRecords.filter((record) => record.status === "present")
    },
    {
      id: "absent",
      title: "Absent Students",
      emptyMessage: "No absent students in this draft.",
      records: todayDraftRecords.filter((record) => record.status === "absent")
    },
    {
      id: "late",
      title: "Partially Accepted",
      emptyMessage: "No partially accepted students in this draft.",
      records: todayDraftRecords.filter((record) => record.status === "late")
    }
  ];
  const rosterByPersonId = new Map(
    roster.map((student) => [normalizePersonId(student.studentUserId), student])
  );
  const manualPresentCount = roster.filter(
    (student) =>
      manualAttendance.statuses[normalizePersonId(student.studentUserId)] === "present"
  ).length;
  const manualAbsentCount = Math.max(0, roster.length - manualPresentCount);
  const totalCaptureImages = uploadedCaptureImages.length + capturedImages.length;
  const hasReadyFaceProfiles = overview.readyFaceProfiles > 0;
  const pendingFaceProfiles = Math.max(
    0,
    overview.studentsCount - overview.readyFaceProfiles
  );
  const canRunAttendance =
    !captureStatus.pending && totalCaptureImages > 0 && hasReadyFaceProfiles;
  const selectedCaptureItems = [
    ...uploadedCaptureImages.map((image, index) => ({
      key: `upload-${image.fileName}-${index}`,
      label: image.fileName,
      source: "Upload",
      sourceType: "upload",
      index
    })),
    ...capturedImages.map((image, index) => ({
      key: `camera-${image.fileName}-${index}`,
      label: image.fileName,
      source: "Camera",
      sourceType: "camera",
      index
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
  const acceptedSuggestedPersonIdSet = new Set(acceptedSuggestedPersonIds);
  const activeReviewPersonIdSet = new Set(
    attendanceSession?.reviewQueue
      .map((student) => student.personId)
      .filter(Boolean) ?? []
  );
  const manualCorrectionStudents = attendanceSession?.absentStudents.filter(
    (student) => !activeReviewPersonIdSet.has(student.personId)
  ) ?? [];
  const currentPresentIds = new Set([
    ...acceptedSuggestedPersonIds,
    ...attendanceDraft.confirmedReviewPersonIds,
    ...attendanceDraft.manuallyAddedPresentIds
  ]);
  const currentAbsentCount = attendanceSession
    ? Math.max(0, roster.length - currentPresentIds.size)
    : 0;
  const unresolvedReviewCount = attendanceSession
    ? attendanceSession.reviewQueue.filter(
        (student) =>
          student.personId &&
          !acceptedSuggestedPersonIdSet.has(student.personId) &&
          !attendanceDraft.confirmedReviewPersonIds.includes(student.personId)
      ).length
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
  const verificationNotes = getRelevantVerificationNotes(attendanceSession?.notes);
  const headerSubtitle = attendanceOnly
    ? "Teacher Attendance Workspace"
    : "Teacher Classroom Workspace";
  const activeNavLabel = attendanceOnly ? "Take Attendance" : "Class Workspace";
  const backRoute = attendanceOnly
    ? `/teacher-classroom?classId=${encodeURIComponent(classId)}`
    : "/teacher-dashboard";
  const backLabel = attendanceOnly ? "Back to Class" : "Back to Dashboard";
  const exportRangeInvalid =
    Boolean(attendanceExport.fromDate && attendanceExport.toDate) &&
    attendanceExport.fromDate > attendanceExport.toDate;
  const exportRecordsInRange = roster.flatMap((student) =>
    (student.attendanceCalendar ?? [])
      .filter(
        (record) =>
          attendanceExport.fromDate &&
          attendanceExport.toDate &&
          record.date >= attendanceExport.fromDate &&
          record.date <= attendanceExport.toDate
      )
      .map((record) => ({
        ...record,
        student
      }))
  );
  function getRosterStudent(personId) {
    return rosterByPersonId.get(normalizePersonId(personId));
  }

  function handleExportAttendanceCsv() {
    if (!attendanceExport.fromDate || !attendanceExport.toDate) {
      setAttendanceExport((currentExport) => ({
        ...currentExport,
        message: "Select both from and to dates before downloading."
      }));
      return;
    }

    if (exportRangeInvalid) {
      setAttendanceExport((currentExport) => ({
        ...currentExport,
        message: "From date must be before or equal to to date."
      }));
      return;
    }

    if (!exportRecordsInRange.length) {
      setAttendanceExport((currentExport) => ({
        ...currentExport,
        message: "No attendance records found in this date range."
      }));
      return;
    }

    const csvRows = [
      ["Class Name", classroom.subjectName],
      ["Class Code", classroom.subjectCode],
      ["Section", classroom.section],
      ["Room", classroom.room || "Room pending"],
      ["From Date", attendanceExport.fromDate],
      ["To Date", attendanceExport.toDate],
      ["Records", exportRecordsInRange.length],
      [],
      ["Date", "Roll No", "Student ID", "Name", "Status", "Method", "Notes"]
    ];

    exportRecordsInRange
      .slice()
      .sort((left, right) => {
        if (left.date !== right.date) {
          return left.date.localeCompare(right.date);
        }

        return compareStudentsByRollNumber(left.student, right.student);
      })
      .forEach((record) => {
        csvRows.push([
          record.date,
          record.student.rollNumber || record.student.studentUserId,
          record.student.studentUserId,
          record.student.studentName,
          record.statusLabel || record.status,
          record.verificationMethod || "manual",
          record.notes || ""
        ]);
      });

    const csvContent = csvRows
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    const fileName = `${classroom.subjectCode}-${classroom.section}`
      .replace(/\s+/g, "-")
      .toLowerCase();

    downloadFile(
      csvContent,
      `${fileName}-attendance-${attendanceExport.fromDate}-to-${attendanceExport.toDate}.csv`,
      "text/csv;charset=utf-8"
    );
    setAttendanceExport((currentExport) => ({
      ...currentExport,
      message: `${exportRecordsInRange.length} attendance records downloaded.`
    }));
  }

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="dashboard-topbar glass-card">
        <AppBrand href="#/" subtitle={headerSubtitle} />

        <nav className="dashboard-nav">
          <button
            className="dashboard-nav-button"
            type="button"
            onClick={() => goToRoute("/teacher-dashboard")}
          >
            Dashboard
          </button>
          <button className="dashboard-nav-button active-teacher-nav" type="button">
            {activeNavLabel}
          </button>
        </nav>

        <div className="dashboard-header-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => goToRoute(backRoute)}
          >
            {backLabel}
          </button>
          <button className="primary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-shell">
        {!attendanceOnly ? (
        <section className="teacher-classroom-hero">
          <article className="glass-card teacher-classroom-intro">
            <div className="dashboard-kicker-row">
              <span className="pill">Class Workspace</span>
              {!classroom.attendanceSubmitted ? (
                <span className="teacher-status-pill pending">No Attendance Yet</span>
              ) : null}
            </div>

            <h1>{classroom.subjectName}</h1>
            <p>{classroom.subjectCode}</p>
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

            <div className="dashboard-profile-strip teacher-classroom-strip today-attendance-strip">
              <div>
                <span>Today's Attendance</span>
                <strong>{todayAttendance?.presentCount ?? 0}</strong>
              </div>
              <div>
                <span>Total Students</span>
                <strong>{todayAttendance?.totalStudents ?? overview.studentsCount}</strong>
              </div>
              <div>
                <span>Absentees</span>
                <strong>{todayAttendance?.absentees ?? 0}</strong>
              </div>
              <div>
                <span>Attendance %</span>
                <strong>{todayAttendance?.attendancePercentage ?? 0}%</strong>
              </div>
            </div>

            <div className="teacher-class-actions" style={{ marginTop: "20px" }}>
              <button
                className="ghost-button"
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
            </div>
          </article>

          <article className="glass-card dashboard-panel">
            <div className="teacher-classroom-side-card">
              <span className="pill">Class Tools</span>

              <div className="teacher-classroom-tools">
                <button
                  className="classroom-tool-button classroom-tool-button-attendance"
                  type="button"
                  onClick={() =>
                    goToRoute(
                      `/teacher-classroom-attendance?classId=${encodeURIComponent(classId)}`
                    )
                  }
                >
                  Take Attendance
                </button>
                <button
                  className="classroom-tool-button classroom-tool-button-notes"
                  type="button"
                  onClick={() =>
                    goToRoute(`/class-notes?classId=${encodeURIComponent(classId)}`)
                  }
                >
                  Notes
                </button>
                <button
                  className="classroom-tool-button classroom-tool-button-assignments"
                  type="button"
                  onClick={() =>
                    goToRoute(
                      `/class-assignments?classId=${encodeURIComponent(classId)}`
                    )
                  }
                >
                  Assignments
                </button>
                <button
                  className="classroom-tool-button classroom-tool-button-discussion"
                  type="button"
                  onClick={() =>
                    goToRoute(
                      `/class-discussion?classId=${encodeURIComponent(classId)}`
                    )
                  }
                >
                  Discussion
                </button>
                <button
                  className="classroom-tool-button classroom-tool-button-students"
                  type="button"
                  onClick={() =>
                    goToRoute(
                      `/teacher-classroom-students?classId=${encodeURIComponent(classId)}`
                    )
                  }
                >
                  Student Details
                </button>
                <button
                  className="classroom-tool-button classroom-tool-button-sessions"
                  type="button"
                  onClick={() =>
                    goToRoute(
                      `/teacher-classroom-sessions?classId=${encodeURIComponent(classId)}`
                    )
                  }
                >
                  Recent Sessions
                </button>
                <button
                  className="classroom-tool-button classroom-tool-button-assignments"
                  type="button"
                  onClick={() =>
                    goToRoute(
                      `/teacher-class-exam?classId=${encodeURIComponent(classId)}`
                    )
                  }
                >
                  Exam Setup
                </button>
                <button
                  className="classroom-tool-button classroom-tool-button-download"
                  type="button"
                  disabled={classroom.status === "archived"}
                  onClick={() =>
                    goToRoute(
                      `/teacher-class-qr?classId=${encodeURIComponent(classId)}`
                    )
                  }
                >
                  QR Code
                </button>
                <button
                  className="classroom-tool-button classroom-tool-button-danger"
                  type="button"
                  disabled={
                    classroom.status === "archived" ||
                    classArchiveStatus.pending ||
                    classDeleteStatus.pending
                  }
                  onClick={handleArchiveClassroom}
                >
                  {classroom.status === "archived"
                    ? "Class Ended"
                    : classArchiveStatus.pending
                      ? "Ending..."
                    : "End Class"}
                </button>
                <button
                  className="classroom-tool-button classroom-tool-button-danger"
                  type="button"
                  disabled={classArchiveStatus.pending || classDeleteStatus.pending}
                  onClick={handleDeleteClassroom}
                >
                  {classDeleteStatus.pending ? "Deleting..." : "Delete Class"}
                </button>
              </div>

              {classArchiveStatus.message ? (
                <span className="panel-meta">{classArchiveStatus.message}</span>
              ) : null}
              {classDeleteStatus.message ? (
                <span className="panel-meta">{classDeleteStatus.message}</span>
              ) : null}

              <section className="attendance-download-panel">
                <div>
                  <span className="pill">Download Attendance</span>
                  <h3>Select date range</h3>
                </div>

                <div className="attendance-download-grid">
                  <label className="field">
                    <span>From date</span>
                    <input
                      type="date"
                      value={attendanceExport.fromDate}
                      onChange={(event) =>
                        updateAttendanceExport("fromDate", event.target.value)
                      }
                    />
                  </label>
                  <label className="field">
                    <span>To date</span>
                    <input
                      type="date"
                      value={attendanceExport.toDate}
                      onChange={(event) =>
                        updateAttendanceExport("toDate", event.target.value)
                      }
                    />
                  </label>
                </div>

                <div className="attendance-download-actions">
                  <button
                    className="primary-button"
                    type="button"
                    disabled={
                      !attendanceExport.fromDate ||
                      !attendanceExport.toDate ||
                      exportRangeInvalid
                    }
                    onClick={handleExportAttendanceCsv}
                  >
                    Download CSV
                  </button>
                  <span className="panel-meta">
                    {attendanceExport.fromDate && attendanceExport.toDate && !exportRangeInvalid
                      ? `${exportRecordsInRange.length} record${exportRecordsInRange.length === 1 ? "" : "s"} selected`
                      : "Choose from and to dates from the calendar fields."}
                  </span>
                </div>

              {attendanceExport.message ? (
                <span className="panel-meta attendance-download-message">
                  {attendanceExport.message}
                </span>
              ) : null}
              </section>

            </div>
          </article>
        </section>
        ) : (
          <section className="teacher-classroom-hero teacher-attendance-hero">
            <article className="glass-card teacher-classroom-intro">
              <div className="dashboard-kicker-row">
                <span className="pill">Take Attendance</span>
                {!classroom.attendanceSubmitted ? (
                  <span className="teacher-status-pill pending">No Attendance Yet</span>
                ) : null}
              </div>

              <h1>{classroom.subjectName}</h1>
              <p>{classroom.subjectCode}</p>
            </article>
          </section>
        )}

        {attendanceOnly ? (
        <section className="teacher-classroom-main">
          <article className="glass-card dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <span className="pill">Take Attendance</span>
              </div>
            </div>

            <div
              className={`teacher-readiness-banner ${
                hasReadyFaceProfiles ? "ready" : "blocked"
              }`}
            >
              <strong>
                {overview.readyFaceProfiles}/{overview.studentsCount} current face profiles ready
              </strong>
              {hasReadyFaceProfiles && !pendingFaceProfiles ? null : (
                <span>
                  {hasReadyFaceProfiles
                    ? `${pendingFaceProfiles} student(s) still need fresh enrollment and may require manual correction.`
                    : "Students must complete current face enrollment before AI attendance can run."}
                </span>
              )}
            </div>

            <div className="teacher-class-actions manual-attendance-toggle">
              <button
                className={manualAttendanceOpen ? "secondary-button" : "primary-button"}
                type="button"
                disabled={manualAttendance.pending}
                onClick={() =>
                  setManualAttendanceOpen((currentValue) => !currentValue)
                }
              >
                {manualAttendanceOpen ? "Hide Manual Attendance" : "Manual Attendance"}
              </button>
            </div>

            {manualAttendanceOpen ? (
            <form className="manual-attendance-panel" onSubmit={handleSubmitManualAttendance}>
              <div className="manual-attendance-head">
                <div>
                  <span className="pill">Manual Attendance</span>
                </div>
                <div className="manual-attendance-summary">
                  <strong>{manualPresentCount}</strong>
                  <span>present</span>
                  <strong>{manualAbsentCount}</strong>
                  <span>absent</span>
                </div>
              </div>

              <div className="teacher-class-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={manualAttendance.pending || !roster.length}
                  onClick={() => markAllManual("present")}
                >
                  Mark All Present
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={manualAttendance.pending || !roster.length}
                  onClick={() => markAllManual("absent")}
                >
                  Mark All Absent
                </button>
                <button
                  className="ghost-button danger-action"
                  type="button"
                  disabled={manualAttendance.pending || !roster.length}
                  onClick={handleCancelTodayClass}
                >
                  Cancel Today&apos;s Class
                </button>
              </div>

              <div className="attendance-session-options">
                <label className="field attendance-unit-field">
                  <span>Attendance Unit</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={manualAttendance.attendanceUnit}
                    onChange={(event) =>
                      updateManualAttendanceUnit(event.target.value)
                    }
                    disabled={manualAttendance.pending}
                  />
                </label>
                <label className="attendance-extra-class-option">
                  <input
                    type="checkbox"
                    checked={manualAttendance.sessionType === "extra"}
                    onChange={(event) =>
                      updateManualSessionType(event.target.checked)
                    }
                    disabled={manualAttendance.pending}
                  />
                  <span>Extra Class</span>
                </label>
              </div>

              <div className="manual-attendance-list">
                {sortedRoster.length ? (
                  sortedRoster.map((student) => {
                    const studentId = normalizePersonId(student.studentUserId);
                    const status = manualAttendance.statuses[studentId] ?? "absent";

                    return (
                      <article key={student.studentUserId} className="manual-attendance-row">
                        <div className="teacher-review-student">
                          <StudentReviewAvatar
                            student={student}
                            name={student.studentName}
                          />
                          <div className="teacher-review-student-main">
                            <div className="teacher-review-student-name">
                              <strong>{student.studentName}</strong>
                              <span>Roll No: {student.rollNumber || student.studentUserId}</span>
                            </div>
                          </div>
                        </div>

                        <div className="manual-status-toggle" aria-label={`${student.studentName} attendance status`}>
                          <button
                            className={status === "present" ? "manual-status-button present active" : "manual-status-button present"}
                            type="button"
                            onClick={() => updateManualStudentStatus(studentId, "present")}
                          >
                            Present
                          </button>
                          <button
                            className={status === "absent" ? "manual-status-button absent active" : "manual-status-button absent"}
                            type="button"
                            onClick={() => updateManualStudentStatus(studentId, "absent")}
                          >
                            Absent
                          </button>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p className="panel-fallback">
                    Add students to this class before marking manual attendance.
                  </p>
                )}
              </div>

              <label className="field">
                <span>Manual attendance note</span>
                <textarea
                  value={manualAttendance.notes}
                  onChange={(event) => updateManualNotes(event.target.value)}
                  rows="2"
                  placeholder="Optional note for this manual attendance session."
                />
              </label>

              <div className="teacher-class-actions">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={manualAttendance.pending || !roster.length}
                >
                  {manualAttendance.pending ? "Submitting..." : "Submit Manual Attendance"}
                </button>
                {manualAttendance.message ? (
                  <span className={`teacher-status-copy ${manualAttendance.tone}`}>
                    {manualAttendance.message}
                  </span>
                ) : null}
              </div>
            </form>
            ) : null}

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
                  disabled={!canRunAttendance}
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
                <button
                  className="secondary-button"
                  type="button"
                  disabled={captureStatus.pending || totalCaptureImages === 0}
                  onClick={resetCaptureSelection}
                >
                  Clear Captures
                </button>
              </div>

              {captureStatus.message ? (
                <p className={`teacher-status-copy ${captureStatus.tone}`}>
                  {captureStatus.message}
                </p>
              ) : null}
            </form>

            {camera.open ? (
              <div className="teacher-camera-card">
                <div className="teacher-camera-frame">
                  <video
                    ref={videoRef}
                    className="teacher-camera-preview"
                    autoPlay
                    muted
                    playsInline
                  />
                </div>
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

            {todayAttendanceDraft ? (
              <section className="today-attendance-draft-panel">
                <div className="today-draft-head">
                  <div>
                    <span className="pill">Today Attendance Data</span>
                    <h3>Review the preliminary attendance before final submission.</h3>
                    <p>
                      Use this list to add or remove students from today&apos;s
                      present list before the 12-hour auto-finalize window closes.
                      Click Send Email only when you want absentee notices sent.
                    </p>
                  </div>

                  <div className="today-draft-summary-grid">
                    <article>
                      <strong>{todayDraftPresentCount}</strong>
                      <span>present</span>
                    </article>
                    <article>
                      <strong>{todayDraftAbsentCount}</strong>
                      <span>absent</span>
                    </article>
                    <article>
                      <strong>{todayDraftLateCount}</strong>
                      <span>partial</span>
                    </article>
                  </div>
                </div>

                <div className="today-draft-meta-grid">
                  <span>
                    <strong>Auto finalizes</strong>
                    {formatDateTime(todayAttendanceDraft.expiresAt)}
                  </span>
                  <span>
                    <strong>Absentee email</strong>
                    {todayAttendanceDraft.absenteeEmailSentAt
                      ? `Processed ${formatDateTime(todayAttendanceDraft.absenteeEmailSentAt)}`
                      : "Not sent yet"}
                  </span>
                  <span>
                    <strong>Source</strong>
                    {todayAttendanceDraft.sourceSessionId
                      ? `AI scan ${todayAttendanceDraft.sourceSessionId.slice(0, 8)}`
                      : "Teacher draft"}
                  </span>
                </div>

                <div className="today-draft-groups">
                  {todayDraftRecords.length ? (
                    todayDraftRecordGroups.map((group) => (
                      <section
                        key={group.id}
                        className={`today-draft-group ${group.id}`}
                      >
                        <div className="today-draft-group-head">
                          <h4>{group.title}</h4>
                          <span>{group.records.length}</span>
                        </div>

                        <div className="today-draft-list">
                          {group.records.length ? (
                            group.records.map((record) => {
                              const studentId = normalizePersonId(record.studentId);
                              const rosterStudent = getRosterStudent(studentId);
                              const statusLabel =
                                record.status === "late"
                                  ? "Partially Accepted"
                                  : record.status === "present"
                                    ? "Present"
                                    : "Absent";

                              return (
                                <article key={studentId} className="today-draft-row">
                                  <StudentReviewSummary
                                    student={{
                                      studentName: record.studentName,
                                      personId: studentId,
                                      rollNumber: record.rollNumber
                                    }}
                                    rosterStudent={rosterStudent}
                                    statusLabel={statusLabel}
                                    statusTone={
                                      record.status === "absent" ? "absent" : "present"
                                    }
                                    confidence={record.confidence}
                                  />

                                  <div
                                    className="manual-status-toggle today-draft-toggle"
                                    aria-label={`${record.studentName} today attendance status`}
                                  >
                                    <button
                                      className={
                                        record.status === "present"
                                          ? "manual-status-button present active"
                                          : "manual-status-button present"
                                      }
                                      type="button"
                                      disabled={todayDraftBusy}
                                      onClick={() =>
                                        updateTodayDraftStudentStatus(studentId, "present")
                                      }
                                    >
                                      Present
                                    </button>
                                    <button
                                      className={
                                        record.status === "absent"
                                          ? "manual-status-button absent active"
                                          : "manual-status-button absent"
                                      }
                                      type="button"
                                      disabled={todayDraftBusy}
                                      onClick={() =>
                                        updateTodayDraftStudentStatus(studentId, "absent")
                                      }
                                    >
                                      Absent
                                    </button>
                                    <button
                                      className={
                                        record.status === "late"
                                          ? "manual-status-button late active"
                                          : "manual-status-button late"
                                      }
                                      type="button"
                                      disabled={todayDraftBusy}
                                      onClick={() =>
                                        updateTodayDraftStudentStatus(studentId, "late")
                                      }
                                    >
                                      Partial
                                    </button>
                                  </div>
                                </article>
                              );
                            })
                          ) : (
                            <p className="panel-fallback">{group.emptyMessage}</p>
                          )}
                        </div>
                      </section>
                    ))
                  ) : (
                    <p className="panel-fallback">
                      No draft records are available for today yet. Run attendance
                      verification to create the review list.
                    </p>
                  )}
                </div>

                <div className="attendance-session-options">
                  <label className="field attendance-unit-field">
                    <span>Attendance Unit</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={todayDraftUi.attendanceUnit}
                      onChange={(event) =>
                        updateTodayDraftAttendanceUnit(event.target.value)
                      }
                      disabled={todayDraftBusy}
                    />
                  </label>
                  <label className="attendance-extra-class-option">
                    <input
                      type="checkbox"
                      checked={todayDraftUi.sessionType === "extra"}
                      onChange={(event) =>
                        updateTodayDraftSessionType(event.target.checked)
                      }
                      disabled={todayDraftBusy}
                    />
                    <span>Extra Class</span>
                  </label>
                </div>

                <label className="field">
                  <span>Today attendance note</span>
                  <textarea
                    value={todayDraftUi.notes}
                    onChange={(event) => updateTodayDraftNotes(event.target.value)}
                    rows="3"
                    placeholder="Add correction context before final submission."
                    disabled={todayDraftBusy}
                  />
                </label>

                <div className="teacher-class-actions today-draft-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={todayDraftBusy}
                    onClick={handleTakeAgainTodayDraft}
                  >
                    {todayDraftUi.retakePending ? "Removing..." : "Take Again"}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={todayDraftBusy || !todayDraftRecords.length}
                    onClick={handleSaveTodayDraft}
                  >
                    {todayDraftUi.pending ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={todayDraftBusy || todayDraftAbsentCount === 0}
                    onClick={handleSendTodayDraftAbsenteeEmail}
                  >
                    {todayDraftUi.emailPending ? "Sending..." : "Send Email"}
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={todayDraftBusy || !todayDraftRecords.length}
                    onClick={handleFinalizeTodayDraft}
                  >
                    {todayDraftUi.pending ? "Finalizing..." : "Final Submission"}
                  </button>
                  <span className="panel-meta">
                    Final submission writes {todayDraftPresentCount} present and{" "}
                    {todayDraftAbsentCount} absent records as {todayDraftUi.attendanceUnit || 1} unit(s)
                    {todayDraftUi.sessionType === "extra" ? " for an extra class." : "."}
                  </span>
                </div>

                {todayDraftUi.message ? (
                  <p className={`teacher-status-copy ${todayDraftUi.tone}`}>
                    {todayDraftUi.message}
                  </p>
                ) : null}
              </section>
            ) : null}

            {attendanceSession && !todayAttendanceDraft ? (
              <form className="teacher-attendance-review" onSubmit={handleFinalizeAttendance}>
                <div className="teacher-session-summary-grid">
                  {attendanceReviewMetrics.map((metric) => (
                    <article key={metric.label} className="teacher-session-summary-card">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </article>
                  ))}
                </div>

                {verificationNotes.length ? (
                  <div className="simple-list teacher-session-notes">
                    {verificationNotes.map((note, index) => (
                      <div key={`${note}-${index}`} className="simple-list-item">
                        <strong>Verification Note</strong>
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div
                  className={`teacher-review-readiness ${
                    unresolvedReviewCount ? "warning" : "ready"
                  }`}
                >
                  <strong>
                    {currentPresentIds.size} present now • {currentAbsentCount} absent if submitted
                  </strong>
                  <span>
                    {unresolvedReviewCount
                      ? `${unresolvedReviewCount} low-confidence roster match(es) are still unchecked and will be treated absent unless confirmed.`
                      : "All roster review decisions are resolved. Unknown detections remain informational unless you manually mark a student present."}
                  </span>
                </div>

                <div className="teacher-review-group">
                  <h3>Suggested Present</h3>
                  {suggestedStudents.length ? (
                    suggestedStudents.map((student) => {
                      const isAccepted =
                        attendanceDraft.acceptedSuggestedTrackIds.includes(
                          student.trackId
                        );

                      return (
                        <label key={student.trackId} className="teacher-review-card">
                          <input
                            type="checkbox"
                            checked={isAccepted}
                            onChange={() =>
                              updateArrayToggle(
                                "acceptedSuggestedTrackIds",
                                student.trackId
                              )
                            }
                          />
                          <StudentReviewSummary
                            student={student}
                            rosterStudent={getRosterStudent(student.personId)}
                            statusLabel={isAccepted ? "Present" : "Not Present"}
                            statusTone={isAccepted ? "present" : "absent"}
                            confidence={student.confidence}
                          />
                        </label>
                      );
                    })
                  ) : (
                    <p className="panel-fallback">
                      No automatic present matches were suggested from this capture.
                    </p>
                  )}
                </div>

                <div className="teacher-review-group">
                  <h3>Low-Confidence Review</h3>
                  {attendanceSession.reviewQueue.length ? (
                    attendanceSession.reviewQueue.map((student) => {
                      const alreadyAcceptedBySuggestion =
                        student.personId &&
                        acceptedSuggestedPersonIdSet.has(student.personId);
                      const isConfirmed =
                        !alreadyAcceptedBySuggestion &&
                        attendanceDraft.confirmedReviewPersonIds.includes(
                          student.personId
                        );

                      return (
                        <label key={student.trackId} className="teacher-review-card">
                          <input
                            type="checkbox"
                            disabled={!student.personId || alreadyAcceptedBySuggestion}
                            checked={isConfirmed}
                            onChange={() => toggleConfirmedReviewPerson(student.personId)}
                          />
                          <StudentReviewSummary
                            student={student}
                            rosterStudent={getRosterStudent(student.personId)}
                            statusLabel={
                              alreadyAcceptedBySuggestion || isConfirmed
                                ? "Present"
                                : "Not Present"
                            }
                            statusTone={
                              alreadyAcceptedBySuggestion || isConfirmed
                                ? "present"
                                : "absent"
                            }
                            confidence={student.confidence}
                          >
                            {alreadyAcceptedBySuggestion ? (
                              <span className="teacher-review-inline-note">
                                Already counted from a stronger accepted match.
                              </span>
                            ) : null}
                            {student.reasons.length ? (
                              <span>{student.reasons.join(" • ")}</span>
                            ) : null}
                          </StudentReviewSummary>
                        </label>
                      );
                    })
                  ) : (
                    <p className="panel-fallback">
                      No low-confidence roster matches require review for this session.
                    </p>
                  )}
                </div>

                <div className="teacher-review-group">
                  <h3>Absent or Manual Corrections</h3>
                  {manualCorrectionStudents.length ? (
                    manualCorrectionStudents.map((student) => {
                      const isManuallyPresent =
                        attendanceDraft.manuallyAddedPresentIds.includes(
                          student.personId
                        );

                      return (
                        <label key={student.personId} className="teacher-review-card">
                          <input
                            type="checkbox"
                            checked={isManuallyPresent}
                            onChange={() => toggleManualPresentPerson(student.personId)}
                          />
                          <StudentReviewSummary
                            student={student}
                            rosterStudent={getRosterStudent(student.personId)}
                            statusLabel={isManuallyPresent ? "Present" : "Absent"}
                            statusTone={isManuallyPresent ? "present" : "absent"}
                            confidence={null}
                          >
                            <span>{student.reason}</span>
                          </StudentReviewSummary>
                        </label>
                      );
                    })
                  ) : (
                    <p className="panel-fallback">
                      No additional absent students need manual correction for this session.
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
                        <StudentReviewSummary
                          student={{ fullName: "Unknown detection" }}
                          statusLabel="Unknown"
                          statusTone="unknown"
                          confidence={detection.confidence}
                          metaLabel="Track ID"
                          metaValue={detection.trackId}
                        >
                          {detection.reasons.length ? (
                            <span>{detection.reasons.join(" • ")}</span>
                          ) : null}
                        </StudentReviewSummary>
                      </article>
                    ))
                  ) : (
                    <p className="panel-fallback">
                      No unmatched faces were detected in this capture.
                    </p>
                  )}
                </div>

                <div className="attendance-session-options">
                  <label className="field attendance-unit-field">
                    <span>Attendance Unit</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={attendanceDraft.attendanceUnit}
                      onChange={(event) =>
                        setAttendanceDraft((currentDraft) => ({
                          ...currentDraft,
                          attendanceUnit: event.target.value
                        }))
                      }
                      disabled={captureStatus.pending}
                    />
                  </label>
                  <label className="attendance-extra-class-option">
                    <input
                      type="checkbox"
                      checked={attendanceDraft.sessionType === "extra"}
                      onChange={(event) =>
                        setAttendanceDraft((currentDraft) => ({
                          ...currentDraft,
                          sessionType: event.target.checked ? "extra" : "regular"
                        }))
                      }
                      disabled={captureStatus.pending}
                    />
                    <span>Extra Class</span>
                  </label>
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
                    {currentAbsentCount} absent as {attendanceDraft.attendanceUnit || 1} unit(s)
                    {attendanceDraft.sessionType === "extra" ? " for an extra class." : "."}
                  </span>
                </div>
              </form>
            ) : null}

            {finalizedAttendance ? (
              <article className="alert-card positive teacher-finalized-card">
                <h3>Attendance Submitted</h3>
                <p>
                  {finalizedAttendance.totalPresent} present •{" "}
                  {finalizedAttendance.totalAbsent} absent • Unit{" "}
                  {finalizedAttendance.attendanceUnit ?? 1} •{" "}
                  {finalizedAttendance.sessionType === "extra" ? "Extra Class" : "Scheduled Class"} • Finalized{" "}
                  {formatDateTime(finalizedAttendance.finalizedAt)}
                </p>
                <div className="teacher-class-actions finalized-email-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={
                      attendanceEmailStatus.pending ||
                      finalizedAttendance.totalAbsent === 0
                    }
                    onClick={handleSendFinalizedAbsenteeEmail}
                  >
                    {attendanceEmailStatus.pending ? "Sending..." : "Send Email"}
                  </button>
                  {attendanceEmailStatus.message ? (
                    <span className={`teacher-status-copy ${attendanceEmailStatus.tone}`}>
                      {attendanceEmailStatus.message}
                    </span>
                  ) : null}
                </div>
              </article>
            ) : null}
          </article>
        </section>
        ) : null}
      </main>
    </div>
  );
}
