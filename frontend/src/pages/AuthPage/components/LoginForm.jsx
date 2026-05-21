export function LoginForm({
  form,
  status,
  verification,
  resendCooldown,
  onChange,
  onRoleChange,
  onSubmit,
  onVerificationOtpChange,
  onResendVerification,
  onVerifyEmail
}) {
  return (
    <form className="glass-card auth-card auth-card-compact" onSubmit={onSubmit}>
      <div className="auth-card-header">
        <div>
          <span className="pill">Login</span>
          <h3>Access your account</h3>
        </div>
      </div>

      <div className="role-switcher">
        <button
          className={form.role === "student" ? "role-tab active" : "role-tab"}
          type="button"
          onClick={() => onRoleChange("student")}
        >
          Student
        </button>
        <button
          className={form.role === "teacher" ? "role-tab active" : "role-tab"}
          type="button"
          onClick={() => onRoleChange("teacher")}
        >
          Teacher
        </button>
        <button
          className={form.role === "admin" ? "role-tab active" : "role-tab"}
          type="button"
          onClick={() => onRoleChange("admin")}
        >
          Admin
        </button>
      </div>

      <div className="form-grid single-column">
        <label className="field">
          <span>ID</span>
          <input
            name="userId"
            value={form.userId}
            onChange={onChange}
            placeholder={
              form.role === "admin"
                ? "user"
                : form.role === "teacher"
                  ? "TCH-1001"
                  : "STU-1001"
            }
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            placeholder="Enter password"
            required
          />
        </label>
      </div>

      {verification?.required ? (
        <div className="auth-email-verify-panel">
          <p className="auth-panel-copy">
            Verify this account email before logging in.
          </p>
          <label className="field">
            <span>Email OTP</span>
            <input
              value={verification.otp}
              onChange={(event) => onVerificationOtpChange(event.target.value)}
              placeholder="6 digit OTP"
              inputMode="numeric"
              maxLength={6}
            />
          </label>
          <div className="auth-otp-actions">
            <button
              className="primary-button"
              type="button"
              onClick={onVerifyEmail}
              disabled={status.loading || !verification.otp.trim()}
            >
              Verify Email
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={onResendVerification}
              disabled={status.loading || resendCooldown > 0}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
            </button>
          </div>
        </div>
      ) : null}

      <button className="primary-button submit-button" type="submit" disabled={status.loading}>
        {status.loading ? "Checking..." : "Login"}
      </button>

      {status.message ? <p className="form-message">{status.message}</p> : null}

      {form.role !== "admin" ? (
        <>
          <p className="auth-switch-copy">
            Need an account? <a href="#/signup">Create one here</a>
          </p>
          <p className="auth-switch-copy auth-secondary-link">
            Forgot password? <a href="#/reset-password">Reset it here</a>
          </p>
        </>
      ) : null}
    </form>
  );
}
