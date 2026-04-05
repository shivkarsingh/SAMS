import { useEffect, useMemo, useState } from "react";
import { LoadingCard } from "../../components/common/LoadingCard";
import { AppBrand } from "../../components/common/AppBrand";
import { PageBackground } from "../../components/common/PageBackground";
import { joinStudentClass } from "../../services/api";
import {
  clearPendingJoinCode,
  getPendingJoinCode,
  getSession,
  savePendingJoinCode
} from "../../services/session";
import { getHashSearchParam, goToRoute } from "../../utils/router";

export function JoinClassPage() {
  const session = useMemo(() => getSession(), []);
  const user = session?.user ?? null;
  const joinCodeFromHash = getHashSearchParam("code");
  const pendingJoinCode = getPendingJoinCode();
  const joinCode = joinCodeFromHash ?? pendingJoinCode ?? "";

  const [status, setStatus] = useState({
    loading: true,
    tone: "",
    title: "Preparing class invite...",
    message: ""
  });

  useEffect(() => {
    if (joinCode) {
      savePendingJoinCode(joinCode);
    }

    if (!joinCode) {
      setStatus({
        loading: false,
        tone: "warning",
        title: "Invalid class invite",
        message: "This join link is missing a valid class code."
      });
      return;
    }

    if (!user) {
      setStatus({
        loading: false,
        tone: "warning",
        title: "Login required",
        message:
          "Login with a student account and this class invite will be completed automatically."
      });
      return;
    }

    if (user.role !== "student") {
      setStatus({
        loading: false,
        tone: "warning",
        title: "Student account required",
        message:
          "Only student accounts can use class invite links. Switch to a student login to continue."
      });
      return;
    }

    async function completeJoin() {
      try {
        const response = await joinStudentClass(user.userId, {
          joinInput: joinCode
        });

        clearPendingJoinCode();
        setStatus({
          loading: false,
          tone: "success",
          title: response.classroom.subjectName,
          message: response.message
        });
      } catch (error) {
        setStatus({
          loading: false,
          tone: "warning",
          title: "Unable to join class",
          message:
            error instanceof Error
              ? error.message
              : "The invite could not be completed."
        });
      }
    }

    void completeJoin();
  }, [joinCode, user]);

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="topbar">
        <AppBrand href="#/" subtitle="Class Invite" />

        <div className="topbar-actions">
          <a className="ghost-button" href="#/">
            Home
          </a>
          <button
            className="primary-button"
            type="button"
            onClick={() => goToRoute(user?.role === "student" ? "/student-dashboard" : "/login")}
          >
            {user?.role === "student" ? "Open Dashboard" : "Login"}
          </button>
        </div>
      </header>

      <main className="content-shell">
        {status.loading ? (
          <LoadingCard
            label="Joining Class"
            title="Completing your classroom invite..."
          />
        ) : (
          <section className="glass-card dashboard-panel loading-card">
            <span className="pill">{status.tone === "success" ? "Invite Ready" : "Invite Notice"}</span>
            <h1>{status.title}</h1>
            <p className="loading-copy">{status.message}</p>
            <div className="hero-actions" style={{ marginTop: "20px" }}>
              {!user ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => goToRoute("/login")}
                >
                  Login as Student
                </button>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() =>
                    goToRoute(
                      user.role === "student" ? "/student-dashboard" : "/login"
                    )
                  }
                >
                  {user.role === "student"
                    ? "Go to Student Dashboard"
                    : "Switch Account"}
                </button>
              )}
              <button
                className="secondary-button"
                type="button"
                onClick={() => goToRoute("/")}
              >
                Back Home
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
