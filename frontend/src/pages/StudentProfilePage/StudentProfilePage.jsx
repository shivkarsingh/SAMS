import { useEffect, useMemo, useState } from "react";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import {
  fetchStudentDashboard,
  requestProfileEmailOtp,
  updateUserProfile
} from "../../services/api";
import { clearSession, getSession, saveSession } from "../../services/session";
import { goToRoute } from "../../utils/router";
import { StudentDashboardHeader } from "../StudentDashboardPage/components/StudentDashboardHeader";
import { StudentProfileSection } from "../StudentDashboardPage/components/StudentProfileSection";
import {
  readStoredStudentProfile,
  saveStudentProfile
} from "../StudentDashboardPage/studentProfileStore";
import "../TeacherDashboardPage/TeacherDashboardPage.css";

export function StudentProfilePage() {
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState({
    loading: true,
    message: ""
  });

  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;

  useEffect(() => {
    async function loadProfile() {
      if (!user || user.role !== "student") {
        goToRoute("/login");
        return;
      }

      try {
        const response = await fetchStudentDashboard(user.userId);
        setProfile({
          ...user,
          ...response.profile,
          ...(readStoredStudentProfile(user.userId) ?? {})
        });
        setStatus({
          loading: false,
          message: ""
        });
      } catch (profileError) {
        setStatus({
          loading: false,
          message:
            profileError instanceof Error
              ? profileError.message
              : "Unable to load student profile."
        });
      }
    }

    void loadProfile();
  }, [user]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
  }

  async function handleSaveProfile(nextProfile, emailOtp = "") {
    if (!user) {
      return null;
    }

    const response = await updateUserProfile(user.role, user.userId, {
      ...nextProfile,
      emailOtp
    });
    const mergedProfile = {
      ...nextProfile,
      ...response.user
    };

    setProfile(mergedProfile);
    saveStudentProfile(response.user, mergedProfile);
    saveSession(response.user);
    return response;
  }

  async function handleRequestEmailOtp(email) {
    if (!user) {
      return null;
    }

    return requestProfileEmailOtp(user.role, user.userId, { email });
  }

  if (!user || user.role !== "student") {
    return null;
  }

  if (status.loading) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard label="Loading" title="Preparing your profile..." />
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-shell">
        <PageBackground />
        <main className="dashboard-shell loading-shell">
          <LoadingCard
            label="Profile Error"
            title={status.message || "Unable to load student profile."}
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

      <StudentDashboardHeader
        onLogout={handleLogout}
        onNavigate={() => {}}
        onOpenFaceEnrollment={() => goToRoute("/student-face-enrollment")}
        navItems={[]}
        utilityAction={{
          label: "Dashboard",
          className: "secondary-button",
          onClick: () => goToRoute("/student-dashboard")
        }}
      />

      <main className="dashboard-shell teacher-profile-page-shell">
        <section className="teacher-dashboard-greeting">
          <h1>Profile</h1>
        </section>

        <StudentProfileSection
          profile={profile}
          onSaveProfile={handleSaveProfile}
          onRequestEmailOtp={handleRequestEmailOtp}
        />
      </main>
    </div>
  );
}
