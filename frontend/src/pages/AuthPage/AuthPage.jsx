import { useEffect, useMemo, useState } from "react";
import { AppBrand } from "../../components/common/AppBrand";
import { PageBackground } from "../../components/common/PageBackground";
import {
  loginUser,
  requestPasswordReset,
  requestSignupEmailOtp,
  resendVerificationEmail,
  resetPassword,
  signupUser,
  verifyEmail,
  verifySignupEmailOtp,
  verifyPasswordResetOtp
} from "../../services/api";
import {
  clearPendingJoinCode,
  getPendingJoinCode,
  saveSession
} from "../../services/session";
import { goToRoute } from "../../utils/router";
import { AuthIntroCard } from "./components/AuthIntroCard";
import { LoginForm } from "./components/LoginForm";
import { ResetPasswordForm } from "./components/ResetPasswordForm";
import { SignupForm } from "./components/SignupForm";
import "./AuthPage.css";

const initialSignupState = {
  role: "student",
  firstName: "",
  lastName: "",
  userId: "",
  rollNumber: "",
  password: "",
  confirmPassword: "",
  age: "",
  gender: "",
  batch: "",
  yearOfPassing: "",
  department: "",
  semesterLabel: "",
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

const initialResetState = {
  role: "student",
  userId: "",
  otp: "",
  password: "",
  confirmPassword: ""
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
  },
  admin: {
    title: "Admin account",
    description:
      "Control platform records, remove incorrect accounts, archive classes, and keep the system clean."
  }
};

function buildStudentUserId(firstName, rollNumber) {
  const namePart = String(firstName ?? "").trim().replace(/\s+/g, "");
  const rollPart = String(rollNumber ?? "").trim();

  return namePart && rollPart ? `${namePart}#${rollPart}`.toUpperCase() : "";
}

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
  const [resetForm, setResetForm] = useState(initialResetState);
  const [resetStatus, setResetStatus] = useState({
    loading: false,
    message: ""
  });
  const [signupVerification, setSignupVerification] = useState(null);
  const [signupOtp, setSignupOtp] = useState("");
  const [resetStep, setResetStep] = useState("request");
  const [resetSession, setResetSession] = useState(null);
  const [signupResendCooldown, setSignupResendCooldown] = useState(0);
  const [loginResendCooldown, setLoginResendCooldown] = useState(0);
  const [loginVerification, setLoginVerification] = useState(null);
  const [resetResendCooldown, setResetResendCooldown] = useState(0);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);

  const activeSignupRole = useMemo(
    () => roleHighlights[signupForm.role],
    [signupForm.role]
  );
  const activeLoginRole = useMemo(
    () => roleHighlights[loginForm.role],
    [loginForm.role]
  );
  const activeResetRole = useMemo(
    () => roleHighlights[resetForm.role],
    [resetForm.role]
  );

  useEffect(() => {
    if (resetResendCooldown <= 0) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setResetResendCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [resetResendCooldown]);

  useEffect(() => {
    if (signupResendCooldown <= 0) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setSignupResendCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [signupResendCooldown]);

  useEffect(() => {
    if (loginResendCooldown <= 0) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setLoginResendCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [loginResendCooldown]);

  function startSignupResendCooldown(seconds = 60) {
    const normalizedSeconds = Number(seconds);
    setSignupResendCooldown(
      Number.isFinite(normalizedSeconds) && normalizedSeconds > 0
        ? Math.ceil(normalizedSeconds)
        : 60
    );
  }

  function startResetResendCooldown(seconds = 60) {
    const normalizedSeconds = Number(seconds);
    setResetResendCooldown(
      Number.isFinite(normalizedSeconds) && normalizedSeconds > 0
        ? Math.ceil(normalizedSeconds)
        : 60
    );
  }

  function startLoginResendCooldown(seconds = 60) {
    const normalizedSeconds = Number(seconds);
    setLoginResendCooldown(
      Number.isFinite(normalizedSeconds) && normalizedSeconds > 0
        ? Math.ceil(normalizedSeconds)
        : 60
    );
  }

  function completeLogin(response) {
    saveSession(response.user);
    setAuthenticatedUser(response.user);
    setLoginVerification(null);
    setLoginResendCooldown(0);
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
        goToRoute(`/student-dashboard?joinCode=${encodeURIComponent(pendingJoinCode)}`);
        return;
      }

      goToRoute("/student-dashboard");
      return;
    }

    if (response.user.role === "teacher") {
      goToRoute("/teacher-dashboard");
      return;
    }

    if (response.user.role === "admin") {
      goToRoute("/admin-dashboard");
    }
  }

  function resetPasswordFlow(role = resetForm.role, options = {}) {
    const { clearStatus = true } = options;

    setResetForm({
      ...initialResetState,
      role
    });
    setResetStep("request");
    setResetSession(null);
    setResetResendCooldown(0);

    if (clearStatus) {
      setResetStatus({
        loading: false,
        message: ""
      });
    }
  }

  async function handleSignupSubmit(event) {
    event.preventDefault();
    const normalizedSignupEmail = signupForm.email.trim().toLowerCase();

    if (signupForm.password !== signupForm.confirmPassword) {
      setSignupStatus({
        loading: false,
        message: "Password and confirm password must match."
      });
      return;
    }

    if (
      !signupVerification?.verified ||
      signupVerification.role !== signupForm.role ||
      signupVerification.email !== normalizedSignupEmail ||
      !signupVerification.otp
    ) {
      setSignupStatus({
        loading: false,
        message: "Verify email with OTP before creating the account."
      });
      return;
    }

    setSignupStatus({ loading: true, message: "" });

    try {
      const response = await signupUser({
        ...signupForm,
        emailOtp: signupVerification.otp
      });

      setSignupStatus({
        loading: false,
        message: response.message
      });
      setSignupVerification(null);
      setSignupOtp("");
      setSignupResendCooldown(0);
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

  async function handleRequestSignupEmailOtp() {
    if (signupResendCooldown > 0) {
      setSignupStatus({
        loading: false,
        message: `You can request another OTP in ${signupResendCooldown} seconds.`
      });
      return;
    }

    if (!signupForm.email.trim()) {
      setSignupStatus({
        loading: false,
        message: "Enter your email first."
      });
      return;
    }

    setSignupStatus({ loading: true, message: "" });

    try {
      const response = await requestSignupEmailOtp({
        role: signupForm.role,
        userId: signupForm.userId,
        firstName: signupForm.firstName,
        lastName: signupForm.lastName,
        email: signupForm.email
      });
      const normalizedEmail = signupForm.email.trim().toLowerCase();

      setSignupVerification({
        role: signupForm.role,
        email: normalizedEmail,
        verified: false,
        otp: ""
      });
      setSignupOtp("");
      startSignupResendCooldown(response.retryAfterSeconds ?? 60);
      setSignupStatus({
        loading: false,
        message: `${response.message}${response.verification?.devOtp ? ` Dev OTP: ${response.verification.devOtp}` : ""}`
      });
    } catch (requestError) {
      if (requestError?.retryAfterSeconds) {
        startSignupResendCooldown(requestError.retryAfterSeconds);
      }

      setSignupStatus({
        loading: false,
        message:
          requestError instanceof Error
            ? requestError.message
            : "Unable to send email OTP."
      });
    }
  }

  async function handleVerifySignupEmail() {
    const normalizedSignupEmail = signupForm.email.trim().toLowerCase();

    if (
      !signupVerification ||
      signupVerification.role !== signupForm.role ||
      signupVerification.email !== normalizedSignupEmail
    ) {
      setSignupStatus({
        loading: false,
        message: "Send an OTP to this email first."
      });
      return;
    }

    if (!signupOtp.trim()) {
      setSignupStatus({
        loading: false,
        message: "Enter the OTP sent to your email."
      });
      return;
    }

    setSignupStatus({ loading: true, message: "" });

    try {
      const response = await verifySignupEmailOtp({
        role: signupVerification.role,
        email: signupVerification.email,
        otp: signupOtp
      });
      const verifiedOtp = signupOtp.trim();

      setSignupStatus({
        loading: false,
        message: `${response.message} You can finish creating the account.`
      });
      setSignupVerification((current) => ({
        ...(current ?? {}),
        role: signupVerification.role,
        email: normalizedSignupEmail,
        verified: true,
        verifiedAt: response.verifiedAt,
        otp: verifiedOtp
      }));
      setSignupOtp("");
      setSignupResendCooldown(0);
    } catch (verifyError) {
      setSignupStatus({
        loading: false,
        message:
          verifyError instanceof Error
            ? verifyError.message
            : "Unable to verify email."
      });
    }
  }

  async function handleResendSignupOtp() {
    if (!signupVerification) {
      await handleRequestSignupEmailOtp();
      return;
    }

    await handleRequestSignupEmailOtp();
  }

  function resetSignupEmailVerification() {
    setSignupVerification(null);
    setSignupOtp("");
    setSignupResendCooldown(0);
  }

  function resetLoginEmailVerification() {
    setLoginVerification(null);
    setLoginResendCooldown(0);
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setLoginStatus({ loading: true, message: "" });

    try {
      const response = await loginUser(loginForm);

      completeLogin(response);
    } catch (loginError) {
      setAuthenticatedUser(null);

      if (
        loginError?.verificationRequired ||
        loginError?.code === "EMAIL_VERIFICATION_REQUIRED"
      ) {
        setLoginVerification({
          required: true,
          role: loginForm.role,
          userId: loginForm.userId.trim(),
          otp: ""
        });
      }

      setLoginStatus({
        loading: false,
        message:
          loginError instanceof Error
            ? loginError.message
            : "Unable to log in."
      });
    }
  }

  async function handleResendLoginVerification() {
    if (loginResendCooldown > 0) {
      setLoginStatus({
        loading: false,
        message: `You can request another OTP in ${loginResendCooldown} seconds.`
      });
      return;
    }

    const role = loginVerification?.role ?? loginForm.role;
    const userId = loginVerification?.userId ?? loginForm.userId.trim();

    if (!role || !userId) {
      setLoginStatus({
        loading: false,
        message: "Choose role and enter your account ID first."
      });
      return;
    }

    setLoginStatus({ loading: true, message: "" });

    try {
      const response = await resendVerificationEmail({ role, userId });
      setLoginVerification({
        required: true,
        role,
        userId,
        otp: ""
      });
      startLoginResendCooldown(response.retryAfterSeconds ?? 60);
      setLoginStatus({
        loading: false,
        message: `${response.message}${response.verification?.devOtp ? ` Dev OTP: ${response.verification.devOtp}` : ""}`
      });
    } catch (resendError) {
      if (resendError?.retryAfterSeconds) {
        startLoginResendCooldown(resendError.retryAfterSeconds);
      }

      setLoginStatus({
        loading: false,
        message:
          resendError instanceof Error
            ? resendError.message
            : "Unable to resend verification OTP."
      });
    }
  }

  async function handleVerifyLoginEmail() {
    if (!loginVerification?.otp.trim()) {
      setLoginStatus({
        loading: false,
        message: "Enter the 6 digit OTP sent to your email."
      });
      return;
    }

    setLoginStatus({ loading: true, message: "" });

    try {
      const response = await verifyEmail({
        role: loginVerification.role,
        userId: loginVerification.userId,
        otp: loginVerification.otp
      });

      completeLogin({
        ...response,
        message: `${response.message} Login successful.`
      });
    } catch (verifyError) {
      setLoginStatus({
        loading: false,
        message:
          verifyError instanceof Error
            ? verifyError.message
            : "Unable to verify email."
      });
    }
  }

  async function handleResetSubmit(event) {
    event.preventDefault();

    if (resetStep !== "password" || !resetSession?.resetToken) {
      setResetStatus({
        loading: false,
        message: "Verify OTP before entering a new password."
      });
      return;
    }

    if (resetForm.password !== resetForm.confirmPassword) {
      setResetStatus({
        loading: false,
        message: "New password and confirm password must match."
      });
      return;
    }

    setResetStatus({ loading: true, message: "" });

    try {
      const response = await resetPassword({
        role: resetForm.role,
        userId: resetForm.userId,
        resetToken: resetSession.resetToken,
        password: resetForm.password,
        confirmPassword: resetForm.confirmPassword
      });

      setResetStatus({
        loading: false,
        message: `${response.message} You can now log in as ${response.user.firstName}.`
      });
      resetPasswordFlow(resetForm.role, { clearStatus: false });
    } catch (resetError) {
      setResetStatus({
        loading: false,
        message:
          resetError instanceof Error
            ? resetError.message
            : "Unable to reset password."
      });
    }
  }

  async function handleRequestPasswordResetOtp() {
    if (resetResendCooldown > 0) {
      setResetStatus({
        loading: false,
        message: `You can request another OTP in ${resetResendCooldown} seconds.`
      });
      return;
    }

    if (!resetForm.role || !resetForm.userId) {
      setResetStatus({
        loading: false,
        message: "Choose role and enter your account ID first."
      });
      return;
    }

    setResetStatus({ loading: true, message: "" });

    try {
      const response = await requestPasswordReset({
        role: resetForm.role,
        userId: resetForm.userId
      });

      setResetStep("otp");
      setResetSession(null);
      startResetResendCooldown(response.retryAfterSeconds ?? 60);
      setResetForm((current) => ({
        ...current,
        otp: "",
        password: "",
        confirmPassword: ""
      }));
      setResetStatus({
        loading: false,
        message: `${response.message}${response.reset?.devOtp ? ` Dev OTP: ${response.reset.devOtp}` : ""}`
      });
    } catch (resetError) {
      if (resetError?.retryAfterSeconds) {
        startResetResendCooldown(resetError.retryAfterSeconds);
      }

      setResetStatus({
        loading: false,
        message:
          resetError instanceof Error
            ? resetError.message
            : "Unable to send reset OTP."
      });
    }
  }

  async function handleVerifyPasswordResetOtp() {
    if (!resetForm.otp.trim()) {
      setResetStatus({
        loading: false,
        message: "Enter the 6 digit OTP sent to your email."
      });
      return;
    }

    setResetStatus({ loading: true, message: "" });

    try {
      const response = await verifyPasswordResetOtp({
        role: resetForm.role,
        userId: resetForm.userId,
        otp: resetForm.otp
      });

      setResetSession(response.resetSession);
      setResetStep("password");
      setResetResendCooldown(0);
      setResetForm((current) => ({
        ...current,
        password: "",
        confirmPassword: ""
      }));
      setResetStatus({
        loading: false,
        message: response.message
      });
    } catch (resetError) {
      setResetStatus({
        loading: false,
        message:
          resetError instanceof Error
            ? resetError.message
            : "Unable to verify reset OTP."
      });
    }
  }

  function handleSignupChange(event) {
    const { name, value } = event.target;
    if (name === "email") {
      resetSignupEmailVerification();
    }

    setSignupForm((current) => {
      const nextForm = {
        ...current,
        [name]: value
      };

      if (nextForm.role === "student" && name !== "userId") {
        const currentGeneratedId = buildStudentUserId(
          current.firstName,
          current.rollNumber
        );
        nextForm.userId = buildStudentUserId(
          nextForm.firstName,
          nextForm.rollNumber
        );

        if (
          current.userId &&
          current.userId !== currentGeneratedId
        ) {
          nextForm.userId = current.userId;
        }
      }

      return nextForm;
    });
  }

  function handleLoginChange(event) {
    const { name, value } = event.target;
    if (name === "role" || name === "userId") {
      resetLoginEmailVerification();
    }

    setLoginForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  function handleResetChange(event) {
    const { name, value } = event.target;
    setResetForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  const activeRole =
    mode === "signup"
      ? activeSignupRole
      : mode === "reset-password"
        ? activeResetRole
        : activeLoginRole;

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
            activeRole={activeRole}
            authenticatedUser={authenticatedUser}
          />

          {mode === "signup" ? (
            <SignupForm
              form={signupForm}
              status={signupStatus}
              verification={signupVerification}
              verificationOtp={signupOtp}
              resendCooldown={signupResendCooldown}
              onChange={handleSignupChange}
              onVerificationOtpChange={setSignupOtp}
              onRequestEmailOtp={handleRequestSignupEmailOtp}
              onVerifyEmail={handleVerifySignupEmail}
              onResendVerification={handleResendSignupOtp}
              onRoleChange={(role) => {
                resetSignupEmailVerification();
                setSignupForm((current) => {
                  const nextForm = { ...current, role };

                  if (role === "student") {
                    nextForm.userId =
                      current.userId ||
                      buildStudentUserId(nextForm.firstName, nextForm.rollNumber);
                  }

                  return nextForm;
                });
              }}
              onSubmit={handleSignupSubmit}
            />
          ) : mode === "reset-password" ? (
            <ResetPasswordForm
              form={resetForm}
              status={resetStatus}
              step={resetStep}
              resendCooldown={resetResendCooldown}
              onChange={handleResetChange}
              onRequestOtp={handleRequestPasswordResetOtp}
              onVerifyOtp={handleVerifyPasswordResetOtp}
              onRestart={() => resetPasswordFlow(resetForm.role)}
              onRoleChange={resetPasswordFlow}
              onSubmit={handleResetSubmit}
            />
          ) : (
            <LoginForm
              form={loginForm}
              status={loginStatus}
              verification={loginVerification}
              resendCooldown={loginResendCooldown}
              onChange={handleLoginChange}
              onRoleChange={(role) => {
                resetLoginEmailVerification();
                setLoginForm((current) => ({ ...current, role }));
              }}
              onSubmit={handleLoginSubmit}
              onVerificationOtpChange={(otp) =>
                setLoginVerification((current) =>
                  current ? { ...current, otp } : current
                )
              }
              onResendVerification={handleResendLoginVerification}
              onVerifyEmail={handleVerifyLoginEmail}
            />
          )}
        </section>
      </main>
    </div>
  );
}
