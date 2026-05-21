import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { AppBrand } from "../../components/common/AppBrand";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  createQrAttendanceSession,
  fetchTeacherClassroom
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { getHashSearchParam, goToRoute } from "../../utils/router";
import "../TeacherDashboardPage/TeacherDashboardPage.css";
import "../TeacherClassroomPage/TeacherClassroomPage.css";

const initialQrAttendance = {
  pending: false,
  message: "",
  session: null,
  imageDataUrl: "",
  scanUrl: ""
};

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function TeacherClassQrPage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const classId = getHashSearchParam("classId");
  const [classroomData, setClassroomData] = useState(null);
  const [status, setStatus] = useState({
    loading: true,
    message: ""
  });
  const [qrAttendance, setQrAttendance] = useState(initialQrAttendance);

  async function loadClassroom(activeUser = user) {
    if (!activeUser || activeUser.role !== "teacher") {
      return;
    }

    if (!classId) {
      setStatus({
        loading: false,
        message: "Choose a class before opening QR attendance."
      });
      return;
    }

    try {
      const response = await fetchTeacherClassroom(activeUser.userId, classId);
      setClassroomData(response);
      setStatus({
        loading: false,
        message: ""
      });
    } catch (error) {
      setStatus({
        loading: false,
        message:
          error instanceof Error ? error.message : "Unable to load QR attendance."
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

  async function handleGenerateQrAttendance() {
    if (!classroomData?.roster?.length) {
      setQrAttendance({
        ...initialQrAttendance,
        message: "Add students before generating a QR attendance code."
      });
      return;
    }

    setQrAttendance((currentQrAttendance) => ({
      ...currentQrAttendance,
      pending: true,
      message: ""
    }));

    try {
      const response = await createQrAttendanceSession(user.userId, classId);
      const scanUrl = `${window.location.origin}${window.location.pathname}#/qr-attendance?token=${encodeURIComponent(response.qrSession.token)}`;
      const imageDataUrl = await QRCode.toDataURL(scanUrl, {
        margin: 1,
        width: 260
      });

      setQrAttendance({
        pending: false,
        message: response.message,
        session: response.qrSession,
        imageDataUrl,
        scanUrl
      });
    } catch (error) {
      setQrAttendance({
        ...initialQrAttendance,
        message:
          error instanceof Error
            ? error.message
            : "Unable to generate QR attendance code."
      });
    }
  }

  async function copyQrLink() {
    if (!qrAttendance.scanUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(qrAttendance.scanUrl);
      setQrAttendance((currentQrAttendance) => ({
        ...currentQrAttendance,
        message: "QR attendance link copied to clipboard."
      }));
    } catch {
      setQrAttendance((currentQrAttendance) => ({
        ...currentQrAttendance,
        message: "Unable to copy QR attendance link."
      }));
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
          <LoadingCard label="Loading" title="Preparing QR attendance..." />
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
            label="QR Attendance"
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
        <AppBrand href="#/" subtitle="Teacher QR Attendance" />

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
            QR Code
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
        <section className="glass-card dashboard-panel qr-attendance-panel">
          <div>
            <span className="pill">QR Code Attendance</span>
            <h2>Students scan to mark present</h2>
            <p>
              {classroom.subjectCode} • {classroom.section || "Section pending"} •{" "}
              {classroomData.roster?.length ?? 0} students
            </p>
            <p>Generate a fresh QR code for this class. The code expires in 10 minutes.</p>
          </div>

          <div className="teacher-class-actions">
            <button
              className="primary-button"
              type="button"
              disabled={isArchived || qrAttendance.pending}
              onClick={handleGenerateQrAttendance}
            >
              {qrAttendance.pending ? "Generating..." : "Generate QR Code"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => goToRoute(backToClassRoute)}
            >
              Open Class
            </button>
          </div>

          {qrAttendance.imageDataUrl ? (
            <div className="qr-attendance-card">
              <img src={qrAttendance.imageDataUrl} alt="QR attendance code" />
              <div>
                <strong>{qrAttendance.session?.subjectCode}</strong>
                <span>
                  Expires {formatDateTime(qrAttendance.session?.expiresAt)}
                </span>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={copyQrLink}
                >
                  Copy Link
                </button>
              </div>
            </div>
          ) : null}

          {qrAttendance.message ? (
            <span className="panel-meta">{qrAttendance.message}</span>
          ) : null}
        </section>
      </main>
    </div>
  );
}
