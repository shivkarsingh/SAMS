export function AuthIntroCard({ mode, activeRole, authenticatedUser }) {
  return (
    <article className="glass-card auth-page-intro">
      <span className="pill">{mode === "signup" ? "Sign Up" : "Login"}</span>
      <h1>
        {mode === "signup"
          ? "Create a verified student or teacher account."
          : "Access your account with role, ID, and password."}
      </h1>
      <p>
        {mode === "signup"
          ? "This page collects complete identity information so the backend can register users safely in MongoDB."
          : "This page checks your selected role and credentials against the database before access is granted."}
      </p>

      <div className="info-list">
        <div>
          <strong>{activeRole.title}</strong>
          <span>{activeRole.description}</span>
        </div>
        <div>
          <strong>Security</strong>
          <span>Passwords are hashed before they are stored in the database.</span>
        </div>
        <div>
          <strong>Navigation</strong>
          <span>Each major product area has its own page and its own styles.</span>
        </div>
      </div>

      {authenticatedUser ? (
        <div className="auth-success-card">
          <span className="pill success">Logged In</span>
          <h4>
            {authenticatedUser.firstName} {authenticatedUser.lastName}
          </h4>
          <p>
            {authenticatedUser.role} account connected with ID{" "}
            {authenticatedUser.userId}.
          </p>
        </div>
      ) : null}
    </article>
  );
}

