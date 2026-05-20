export function ResetPasswordForm({
  form,
  status,
  step,
  resendCooldown,
  onChange,
  onRequestOtp,
  onVerifyOtp,
  onRestart,
  onRoleChange,
  onSubmit
}) {
  const isRequestStep = step === "request";
  const isOtpStep = step === "otp";
  const isPasswordStep = step === "password";
  const isAccountLocked = !isRequestStep;
  const hasPasswordMismatch =
    isPasswordStep &&
    form.password &&
    form.confirmPassword &&
    form.password !== form.confirmPassword;

  return (
    <form
      className="glass-card auth-card auth-card-compact"
      onSubmit={isPasswordStep ? onSubmit : (event) => event.preventDefault()}
    >
      <div className="auth-card-header">
        <div>
          <span className="pill">Password Reset</span>
          <h3>Set a new password</h3>
        </div>
      </div>

      <div className="reset-step-strip" aria-label="Password reset progress">
        <span className={isRequestStep ? "active" : ""}>Account</span>
        <span className={isOtpStep ? "active" : ""}>OTP</span>
        <span className={isPasswordStep ? "active" : ""}>Password</span>
      </div>

      <div className="role-switcher">
        <button
          className={form.role === "student" ? "role-tab active" : "role-tab"}
          type="button"
          disabled={isAccountLocked}
          onClick={() => onRoleChange("student")}
        >
          Student
        </button>
        <button
          className={form.role === "teacher" ? "role-tab active" : "role-tab"}
          type="button"
          disabled={isAccountLocked}
          onClick={() => onRoleChange("teacher")}
        >
          Teacher
        </button>
      </div>

      <div className="form-grid single-column">
        <label className="field">
          <span>ID</span>
          <input
            name="userId"
            value={form.userId}
            onChange={onChange}
            placeholder={form.role === "teacher" ? "TCH-1001" : "STU-1001"}
            disabled={isAccountLocked}
            required
          />
        </label>

        {isOtpStep ? (
          <label className="field">
            <span>Email OTP</span>
            <input
              name="otp"
              value={form.otp}
              onChange={onChange}
              placeholder="6 digit OTP"
              inputMode="numeric"
              maxLength={6}
              required
            />
          </label>
        ) : null}

        {isPasswordStep ? (
          <>
            <label className="field">
              <span>New password</span>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={onChange}
                className={hasPasswordMismatch ? "input-error" : undefined}
                placeholder="Create a new password"
                autoComplete="new-password"
                required
              />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={onChange}
                className={hasPasswordMismatch ? "input-error" : undefined}
                placeholder="Enter the password again"
                autoComplete="new-password"
                required
              />
            </label>
          </>
        ) : null}
      </div>

      {isRequestStep ? (
        <button
          className="primary-button submit-button"
          type="button"
          onClick={onRequestOtp}
          disabled={status.loading}
        >
          {status.loading ? "Sending..." : "Send Reset OTP"}
        </button>
      ) : null}

      {isOtpStep ? (
        <div className="reset-otp-actions">
          <button
            className="primary-button"
            type="button"
            onClick={onVerifyOtp}
            disabled={status.loading}
          >
            {status.loading ? "Verifying..." : "Verify OTP"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={onRequestOtp}
            disabled={status.loading || resendCooldown > 0}
          >
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : "Resend OTP"}
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={onRestart}
            disabled={status.loading}
          >
            Change Account
          </button>
        </div>
      ) : null}

      {isPasswordStep ? (
        <button
          className="primary-button submit-button"
          type="submit"
          disabled={status.loading}
        >
          {status.loading ? "Updating..." : "Save New Password"}
        </button>
      ) : null}

      {status.message ? <p className="form-message">{status.message}</p> : null}

      <p className="auth-switch-copy">
        Remembered it? <a href="#/login">Return to login</a>
      </p>
    </form>
  );
}
