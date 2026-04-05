import { useMemo, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { PageBackground } from "../../components/common/PageBackground";
import { loginUser, signupUser } from "../../services/api";
import {
  clearPendingJoinCode,
  getPendingJoinCode,
  saveSession
} from "../../services/session";
import { goToRoute } from "../../utils/router";
import { AuthIntroCard } from "./components/AuthIntroCard";
import { LoginForm } from "./components/LoginForm";
import { SignupForm } from "./components/SignupForm";
import "./AuthPage.css";

const initialSignupState = {
  role: "student",
  firstName: "",
  lastName: "",
  userId: "",
  password: "",
  age: "",
  gender: "male",
  batch: "",
  yearOfPassing: "",
  department: "",
  email: "",
  phoneNumber: "",
  designation: "",
  specialization: "",
  experienceYears: "",
  joiningYear: ""
};

const initialLoginState = {
  role: "student",
  userId: "",
  password: ""
};

const roleHighlights = {
  student: {
    title: "Student account",
    description:
      "Track attendance records, stay updated on performance trends, and access a focused student dashboard."
  },
  teacher: {
    title: "Teacher account",
    description:
      "Manage class attendance, flag at-risk students, and work from a dedicated teacher dashboard."
  }
};

export function AuthPage({ mode }) {
  const [signupForm, setSignupForm] = useState(initialSignupState);
  const [loginForm, setLoginForm] = useState(initialLoginState);
  const [signupStatus, setSignupStatus] = useState({
    loading: false,
    message: ""
  });
  const [loginStatus, setLoginStatus] = useState({
    loading: false,
    message: ""
  });
  const [authenticatedUser, setAuthenticatedUser] = useState(null);

  const activeSignupRole = useMemo(
    () => roleHighlights[signupForm.role],
    [signupForm.role]
  );
  const activeLoginRole = useMemo(
    () => roleHighlights[loginForm.role],
    [loginForm.role]
  );

  async function handleSignupSubmit(event) {
    event.preventDefault();
    setSignupStatus({ loading: true, message: "" });

    try {
      const response = await signupUser(signupForm);

      setSignupStatus({
        loading: false,
        message: `${response.message} ${response.user.firstName} ${response.user.lastName} is now registered as a ${response.user.role}.`
      });
      setSignupForm((current) => ({
        ...initialSignupState,
        role: current.role,
        gender: current.gender
      }));
    } catch (signupError) {
      setSignupStatus({
        loading: false,
        message:
          signupError instanceof Error
            ? signupError.message
            : "Unable to create account."
      });
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setLoginStatus({ loading: true, message: "" });

    try {
      const response = await loginUser(loginForm);

      saveSession(response.user);
      setAuthenticatedUser(response.user);
      setLoginStatus({
        loading: false,
        message: `${response.message} Welcome back, ${response.user.firstName}.`
      });
      setLoginForm((current) => ({
        ...initialLoginState,
        role: current.role
      }));

      if (response.user.role === "student") {
        const pendingJoinCode = getPendingJoinCode();

        if (pendingJoinCode) {
          clearPendingJoinCode();
          goToRoute(`/join-class?code=${encodeURIComponent(pendingJoinCode)}`);
          return;
        }

        goToRoute("/student-dashboard");
        return;
      }

      if (response.user.role === "teacher") {
        goToRoute("/teacher-dashboard");
      }
    } catch (loginError) {
      setAuthenticatedUser(null);
      setLoginStatus({
        loading: false,
        message:
          loginError instanceof Error
            ? loginError.message
            : "Unable to log in."
      });
    }
  }

  function handleSignupChange(event) {
    const { name, value } = event.target;
    setSignupForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  function handleLoginChange(event) {
    const { name, value } = event.target;
    setLoginForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  return (
    <div className="page-shell">
      <PageBackground />

      <header className="topbar">
        <AppBrand href="#/" />

        <div className="topbar-actions">
          <a
            className={mode === "signup" ? "ghost-button active-link" : "ghost-button"}
            href="#/signup"
          >
            Sign Up
          </a>
          <a
            className={mode === "login" ? "primary-button active-link" : "primary-button"}
            href="#/login"
          >
            Login
          </a>
        </div>
      </header>

      <main className="content-shell auth-content-shell">
        <section className="auth-page-grid">
          <AuthIntroCard
            mode={mode}
            activeRole={mode === "signup" ? activeSignupRole : activeLoginRole}
            authenticatedUser={authenticatedUser}
          />

          {mode === "signup" ? (
            <SignupForm
              form={signupForm}
              status={signupStatus}
              onChange={handleSignupChange}
              onRoleChange={(role) =>
                setSignupForm((current) => ({ ...current, role }))
              }
              onSubmit={handleSignupSubmit}
            />
          ) : (
            <LoginForm
              form={loginForm}
              status={loginStatus}
              onChange={handleLoginChange}
              onRoleChange={(role) =>
                setLoginForm((current) => ({ ...current, role }))
              }
              onSubmit={handleLoginSubmit}
            />
          )}
        </section>
      </main>
    </div>
  );
}
