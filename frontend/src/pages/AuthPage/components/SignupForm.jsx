function RequiredMark() {
  return (
    <span className="required-marker" aria-label="required">
      *
    </span>
  );
}

export function SignupForm({
  form,
  status,
  verification,
  verificationOtp,
  resendCooldown,
  onChange,
  onVerificationOtpChange,
  onRequestEmailOtp,
  onVerifyEmail,
  onResendVerification,
  onRoleChange,
  onSubmit
}) {
  const hasPasswordMismatch =
    form.password && form.confirmPassword && form.password !== form.confirmPassword;
  const normalizedEmail = form.email.trim().toLowerCase();
  const isCurrentVerificationEmail =
    verification?.role === form.role && verification?.email === normalizedEmail;
  const isEmailVerified =
    isCurrentVerificationEmail && verification?.verified;
  const isEmailOtpPending =
    isCurrentVerificationEmail && verification && !verification.verified;
  const canShowEmailVerification = form.email.trim();

  return (
    <form className="glass-card auth-card auth-card-large" onSubmit={onSubmit}>
      <div className="auth-card-header">
        <div>
          <span className="pill">Sign Up</span>
          <h3>Create a new account</h3>
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
      </div>

      <div className="form-grid">
        <label className="field">
          <span>
            First Name <RequiredMark />
          </span>
          <input
            name="firstName"
            value={form.firstName}
            onChange={onChange}
            placeholder="Enter first name"
            minLength="2"
            autoComplete="given-name"
            required
          />
        </label>
        <label className="field">
          <span>
            Last Name <RequiredMark />
          </span>
          <input
            name="lastName"
            value={form.lastName}
            onChange={onChange}
            placeholder="Enter last name"
            minLength="2"
            autoComplete="family-name"
            required
          />
        </label>
        <label className="field">
          <span>
            ID <RequiredMark />
          </span>
          <input
            name="userId"
            value={form.userId}
            onChange={onChange}
            placeholder={
              form.role === "student"
                ? "name#rollno or your student ID"
                : undefined
            }
            autoComplete="username"
            required
          />
        </label>
        <label className="field">
          <span>
            Password <RequiredMark />
          </span>
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            className={hasPasswordMismatch ? "input-error" : undefined}
            placeholder="Create password"
            autoComplete="new-password"
            required
          />
        </label>
        <label className="field">
          <span>
            Confirm Password <RequiredMark />
          </span>
          <input
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={onChange}
            className={hasPasswordMismatch ? "input-error" : undefined}
            placeholder="Enter password again"
            autoComplete="new-password"
            required
          />
        </label>
        <label className="field">
          <span>Age</span>
          <input
            name="age"
            type="number"
            min="16"
            max="100"
            value={form.age}
            onChange={onChange}
            placeholder="Enter age"
          />
        </label>
        <label className="field">
          <span>Gender</span>
          <select name="gender" value={form.gender} onChange={onChange}>
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-binary</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
        </label>

        {form.role === "student" ? (
          <>
            <label className="field">
              <span>
                Roll No <RequiredMark />
              </span>
              <input
                name="rollNumber"
                value={form.rollNumber}
                onChange={onChange}
                inputMode="numeric"
                pattern="[0-9]+"
                title="Use numbers only."
                autoComplete="off"
                required
              />
            </label>
            <label className="field">
              <span>Batch</span>
              <input
                name="batch"
                value={form.batch}
                onChange={onChange}
                placeholder="2022-2026"
              />
            </label>
            <label className="field">
              <span>Year Of Passing</span>
              <input
                name="yearOfPassing"
                type="number"
                min="2024"
                max="2100"
                value={form.yearOfPassing}
                onChange={onChange}
              />
            </label>
            <label className="field">
              <span>Semester</span>
              <input
                name="semesterLabel"
                value={form.semesterLabel}
                onChange={onChange}
                placeholder="Sem 3"
              />
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>Designation</span>
              <input
                name="designation"
                value={form.designation}
                onChange={onChange}
              />
            </label>
            <label className="field">
              <span>Specialization</span>
              <input
                name="specialization"
                value={form.specialization}
                onChange={onChange}
              />
            </label>
          </>
        )}

        <label className="field">
          <span>Department</span>
          <input
            name="department"
            value={form.department}
            onChange={onChange}
            placeholder="Computer Science"
          />
        </label>
        <label className="field">
          <span>
            Email <RequiredMark />
            {isEmailVerified ? (
              <span className="email-verified-badge">
                <span aria-hidden="true">✓</span> Verified
              </span>
            ) : null}
          </span>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            placeholder="name@example.com"
            autoComplete="email"
            required
          />
        </label>
        {canShowEmailVerification ? (
          <div
            className={`auth-email-verify-panel field-span-2 ${
              isEmailVerified ? "verified" : ""
            }`}
          >
            {isEmailVerified ? (
              <div className="auth-email-verified">
                <span aria-hidden="true">✓</span>
                <strong>Email verified</strong>
              </div>
            ) : isEmailOtpPending ? (
              <>
                <label className="field">
                  <span>Email OTP</span>
                  <input
                    value={verificationOtp}
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
                    disabled={status.loading}
                  >
                    Verify Email
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={onResendVerification}
                    disabled={status.loading || resendCooldown > 0}
                  >
                    {resendCooldown > 0
                      ? `Resend in ${resendCooldown}s`
                      : "Resend OTP"}
                  </button>
                </div>
              </>
            ) : (
              <button
                className="secondary-button"
                type="button"
                onClick={onRequestEmailOtp}
                disabled={status.loading}
              >
                Verify Email
              </button>
            )}
          </div>
        ) : null}
        <label className="field field-span-2">
          <span>Phone Number</span>
          <input
            name="phoneNumber"
            value={form.phoneNumber}
            onChange={onChange}
            placeholder="+91 98765 43210"
            inputMode="tel"
            pattern={"\\+?[0-9\\s-]{7,15}"}
            title="Use 7 to 15 digits. Spaces, hyphens, and a leading + are allowed."
            autoComplete="tel"
          />
        </label>

        {form.role === "teacher" && (
          <>
            <label className="field">
              <span>Experience In Years</span>
              <input
                name="experienceYears"
                type="number"
                min="0"
                max="60"
                value={form.experienceYears}
                onChange={onChange}
              />
            </label>
            <label className="field">
              <span>Joining Year</span>
              <input
                name="joiningYear"
                type="number"
                min="2000"
                max="2100"
                value={form.joiningYear}
                onChange={onChange}
              />
            </label>
          </>
        )}
      </div>

      <button className="primary-button submit-button" type="submit" disabled={status.loading}>
        {status.loading ? "Creating..." : "Create Account"}
      </button>

      {status.message ? <p className="form-message">{status.message}</p> : null}

      <p className="auth-switch-copy">
        Already have an account? <a href="#/login">Go to login</a>
      </p>
    </form>
  );
}
