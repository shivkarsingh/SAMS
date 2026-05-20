import { useEffect, useMemo, useState } from "react";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import { markQrAttendance } from "../../services/api";
import { getSession } from "../../services/session";
import { getHashSearchParam, goToRoute } from "../../utils/router";

export function QrAttendancePage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const token = getHashSearchParam("token");
  const [status, setStatus] = useState({
    loading: true,
    tone: "",
    title: "Marking attendance...",
    message: ""
  });

  useEffect(() => {
    async function submitQrAttendance() {
      if (!token) {
        setStatus({
          loading: false,
          tone: "warning",
          title: "QR code missing",
          message: "Open the QR code link shared by your teacher."
        });
        return;
      }

      if (!user || user.role !== "student") {
        setStatus({
          loading: false,
          tone: "warning",
          title: "Student login required",
          message: "Log in with your student account, then scan the QR code again."
        });
        return;
      }

      try {
        const response = await markQrAttendance({
          studentId: user.userId,
          token
        });

        setStatus({
          loading: false,
          tone: "success",
          title: "Attendance marked",
          message: `${response.subjectCode} recorded you present. ${response.totalPresent}/${response.totalStudents} students are present so far.`
        });
      } catch (error) {
        setStatus({
          loading: false,
          tone: "warning",
          title: "Unable to mark attendance",
          message:
            error instanceof Error
              ? error.message
              : "This QR attendance code could not be used."
        });
      }
    }

    void submitQrAttendance();
  }, [token, user]);

  return (
    <div className="page-shell">
      <PageBackground />

      <main className="dashboard-shell loading-shell">
        <LoadingCard
          label={status.tone === "success" ? "QR Attendance" : "Attendance"}
          title={status.loading ? "Marking attendance..." : status.title}
          action={
            status.loading ? null : (
              <div className="teacher-class-actions">
                {user?.role === "student" ? (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => goToRoute("/student-dashboard")}
                  >
                    Student Dashboard
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => goToRoute("/login")}
                  >
                    Login
                  </button>
                )}
              </div>
            )
          }
        />
        {status.message ? (
          <p className={`teacher-status-copy ${status.tone}`}>
            {status.message}
          </p>
        ) : null}
      </main>
    </div>
  );
}
