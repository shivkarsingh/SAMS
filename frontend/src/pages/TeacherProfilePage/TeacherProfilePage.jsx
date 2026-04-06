import { useEffect, useMemo, useState } from "react";
import { LoadingCard } from "../../components/common/LoadingCard";
import { PageBackground } from "../../components/common/PageBackground";
import { fetchTeacherDashboard } from "../../services/api";
import { clearSession, getSession } from "../../services/session";
import { goToRoute } from "../../utils/router";
import { TeacherDashboardHeader } from "../TeacherDashboardPage/components/TeacherDashboardHeader";
import { TeacherProfileSection } from "../TeacherDashboardPage/components/TeacherProfileSection";
import { readStoredTeacherProfile, saveTeacherProfile } from "../TeacherDashboardPage/teacherProfileStore";
import "../TeacherDashboardPage/TeacherDashboardPage.css";

export function TeacherProfilePage() {
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState({
    loading: true,
    message: ""
  });

  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;

  useEffect(() => {
    async function loadProfile() {
      if (!user || user.role !== "teacher") {
        goToRoute("/login");
        return;
      }

      try {
        const response = await fetchTeacherDashboard(user.userId);
        setProfile({
          ...response.profile,
          ...(readStoredTeacherProfile(user.userId) ?? {})
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
              : "Unable to load teacher profile."
        });
      }
    }

    void loadProfile();
  }, [user]);

  function handleLogout() {
    clearSession();
    goToRoute("/login");
  }

  function handleSaveProfile(nextProfile) {
    if (!user) {
      return;
    }

    setProfile(nextProfile);
    saveTeacherProfile(user, nextProfile);
  }

  if (!user || user.role !== "teacher") {
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
            title={status.message || "Unable to load teacher profile."}
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

  return (
    <div className="page-shell">
      <PageBackground />

      <TeacherDashboardHeader
        onLogout={handleLogout}
        onNavigate={() => {}}
        utilityAction={{
          label: "Dashboard",
          className: "secondary-button",
          onClick: () => goToRoute("/teacher-dashboard")
        }}
      />

      <main className="dashboard-shell teacher-profile-page-shell">
        <section className="teacher-dashboard-greeting">
          <h1>Profile</h1>
        </section>

        <TeacherProfileSection
          profile={profile}
          onSaveProfile={handleSaveProfile}
        />
      </main>
    </div>
  );
}
