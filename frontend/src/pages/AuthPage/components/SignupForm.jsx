export function SignupForm({ form, status, onChange, onRoleChange, onSubmit }) {
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
          <span>First Name</span>
          <input
            name="firstName"
            value={form.firstName}
            onChange={onChange}
            placeholder="Enter first name"
            required
          />
        </label>
        <label className="field">
          <span>Last Name</span>
          <input
            name="lastName"
            value={form.lastName}
            onChange={onChange}
            placeholder="Enter last name"
            required
          />
        </label>
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
            placeholder="Create password"
            required
          />
        </label>
        <label className="field">
          <span>Age</span>
          <input
            name="age"
            type="number"
            min="16"
            value={form.age}
            onChange={onChange}
            placeholder="Enter age"
            required
          />
        </label>
        <label className="field">
          <span>Gender</span>
          <select name="gender" value={form.gender} onChange={onChange}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-binary</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
        </label>

        {form.role === "student" ? (
          <>
            <label className="field">
              <span>Batch</span>
              <input
                name="batch"
                value={form.batch}
                onChange={onChange}
                placeholder="2022-2026"
                required
              />
            </label>
            <label className="field">
              <span>Year Of Passing</span>
              <input
                name="yearOfPassing"
                type="number"
                min="2024"
                value={form.yearOfPassing}
                onChange={onChange}
                placeholder="2026"
                required
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
                placeholder="Assistant Professor"
                required
              />
            </label>
            <label className="field">
              <span>Specialization</span>
              <input
                name="specialization"
                value={form.specialization}
                onChange={onChange}
                placeholder="Artificial Intelligence"
                required
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
            required
          />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={onChange}
            placeholder="name@example.com"
            required
          />
        </label>
        <label className="field field-span-2">
          <span>Phone Number</span>
          <input
            name="phoneNumber"
            value={form.phoneNumber}
            onChange={onChange}
            placeholder="+91 98765 43210"
            required
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
                value={form.experienceYears}
                onChange={onChange}
                placeholder="5"
                required
              />
            </label>
            <label className="field">
              <span>Joining Year</span>
              <input
                name="joiningYear"
                type="number"
                min="2000"
                value={form.joiningYear}
                onChange={onChange}
                placeholder="2021"
                required
              />
            </label>
          </>
        )}
      </div>

      <button className="primary-button submit-button" type="submit">
        {status.loading ? "Creating..." : "Create Account"}
      </button>

      {status.message ? <p className="form-message">{status.message}</p> : null}

      <p className="auth-switch-copy">
        Already have an account? <a href="#/login">Go to login</a>
      </p>
    </form>
  );
}
