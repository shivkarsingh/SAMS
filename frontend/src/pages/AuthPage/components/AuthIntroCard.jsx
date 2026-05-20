export function AuthIntroCard({ mode, activeRole, authenticatedUser }) {
  const isSignup = mode === "signup";
  const isReset = mode === "reset-password";

  return (
    <article className="glass-card auth-page-intro">
      <span className="pill">
        {isSignup ? "Sign Up" : isReset ? "Password Reset" : "Login"}
      </span>
      <h1>
        {isSignup
          ? "Create a student or teacher account."
          : isReset
            ? "Reset access for your student or teacher account."
            : "Access your account with role, ID, and password."}
      </h1>
      <p>
        {isSignup
          ? "Student signups verify email by OTP; teacher signups can log in after account creation."
          : isReset
            ? "Choose the matching role, verify the email OTP, then enter the new password twice."
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
