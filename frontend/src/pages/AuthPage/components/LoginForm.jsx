export function LoginForm({ form, status, onChange, onRoleChange, onSubmit }) {
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
      </div>

      <div className="form-grid single-column">
        <label className="field">
          <span>ID</span>
          <input
            name="userId"
            value={form.userId}
            onChange={onChange}
            placeholder={form.role === "teacher" ? "TCH-1001" : "STU-1001"}
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

      <button className="primary-button submit-button" type="submit">
        {status.loading ? "Checking..." : "Login"}
      </button>

      {status.message ? <p className="form-message">{status.message}</p> : null}

      <p className="auth-switch-copy">
        Need an account? <a href="#/signup">Create one here</a>
      </p>
    </form>
  );
}

