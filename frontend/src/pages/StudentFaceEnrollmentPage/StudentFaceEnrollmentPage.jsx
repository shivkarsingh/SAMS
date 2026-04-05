import { useEffect, useMemo, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  enrollStudentFaceProfile,
  fetchStudentFaceProfile
} from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { goToRoute } from "../../utils/router";
import { StudentFaceEnrollmentSection } from "../StudentDashboardPage/components/StudentFaceEnrollmentSection";
import "./StudentFaceEnrollmentPage.css";

export function StudentFaceEnrollmentPage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const [faceProfile, setFaceProfile] = useState(null);
  const [status, setStatus] = useState({
    loading: true,
    message: ""
  });

  useEffect(() => {
    if (!user || user.role !== "student") {
      goToRoute("/login");
      return;
    }

    async function loadFaceProfile() {
      try {
        const response = await fetchStudentFaceProfile(user.userId);
        setFaceProfile(response.faceProfile);
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
              : "Unable to load face enrollment profile."
        });
      }
    }

    void loadFaceProfile();
  }, [user]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
  }

  async function handleEnrollFaceProfile(images) {
    const result = await enrollStudentFaceProfile(user.userId, {
      images
    });

    setFaceProfile(result.faceProfile);
    return result;
  }

  if (!user || user.role !== "student") {
    return null;
  }

  if (status.loading) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard
            label="Loading"
            title="Preparing your face enrollment workspace..."
          />
        </main>
      </div>
    );
  }

  if (!faceProfile) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard
            label="Enrollment Error"
            title={status.message || "Unable to load face enrollment page."}
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

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="dashboard-topbar glass-card">
        <AppBrand href="#/" subtitle="Student Face Enrollment" />

        <nav className="dashboard-nav student-workspace-nav">
          <button
            className="dashboard-nav-button"
            type="button"
            onClick={() => goToRoute("/student-dashboard")}
          >
            Dashboard
          </button>
          <button className="dashboard-nav-button active-student-nav" type="button">
            Face Enrollment
          </button>
        </nav>

        <div className="dashboard-header-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => goToRoute("/student-dashboard")}
          >
            Back to Dashboard
          </button>
          <button className="primary-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-shell">
        <section className="student-enrollment-layout">
          <article className="glass-card student-enrollment-intro">
            <div className="dashboard-kicker-row">
              <span className="pill">Dedicated Setup</span>
              <span
                className={`face-profile-status ${
                  faceProfile.status === "enrolled" ? "ready" : "pending"
                }`}
              >
                {faceProfile.status === "enrolled" ? "Ready for Attendance" : "Setup Pending"}
              </span>
            </div>

            <h1>Build and refresh your face profile from one focused workspace.</h1>
            <p>
              Capture live photos, upload enrollment images, and keep your attendance identity
              current without leaving the student area.
            </p>

            <div className="dashboard-profile-strip student-enrollment-strip">
              <div>
                <span>Student</span>
                <strong>{user.firstName ?? user.userId}</strong>
              </div>
              <div>
                <span>ID</span>
                <strong>{user.userId}</strong>
              </div>
              <div>
                <span>Images Used</span>
                <strong>{faceProfile.uploadedImageCount}</strong>
              </div>
              <div>
                <span>Quality Score</span>
                <strong>{Math.round(faceProfile.averageQualityScore * 100)}%</strong>
              </div>
            </div>

            <div className="dashboard-actions">
              <button
                className="secondary-button large"
                type="button"
                onClick={() => goToRoute("/student-dashboard")}
              >
                Return to Dashboard
              </button>
            </div>
          </article>

          <StudentFaceEnrollmentSection
            faceProfile={faceProfile}
            onEnrollFaceProfile={handleEnrollFaceProfile}
          />
        </section>
      </main>
    </div>
  );
}
