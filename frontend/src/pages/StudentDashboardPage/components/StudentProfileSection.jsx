import { useEffect, useState } from "react";
import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";

const editableFields = [
  { name: "firstName", label: "First name" },
  { name: "lastName", label: "Last name" },
  { name: "rollNumber", label: "Roll number" },
  { name: "email", label: "Email" },
  { name: "phoneNumber", label: "Phone number" },
  { name: "department", label: "Department" },
  { name: "batch", label: "Batch" },
  { name: "yearOfPassing", label: "Year of passing" },
  { name: "age", label: "Age" },
  { name: "gender", label: "Gender" }
];

function getInitials(profile) {
  return `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();
}

export function StudentProfileSection({
  profile,
  onSaveProfile,
  onRequestEmailOtp
}) {
  const [form, setForm] = useState(profile);
  const [status, setStatus] = useState("");
  const [emailOtp, setEmailOtp] = useState("");

  useEffect(() => {
    setForm(profile);
    setEmailOtp("");
  }, [profile]);

  function updateField(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateField("avatarDataUrl", String(reader.result ?? ""));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("Saving profile...");

    try {
      const response = await onSaveProfile(form, emailOtp);
      setStatus(response?.message ?? "Profile updated.");
      setEmailOtp("");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to update profile."
      );
    }
  }

  async function handleRequestOtp() {
    setStatus("Sending email OTP...");

    try {
      const response = await onRequestEmailOtp(form.email);
      setStatus(
        `${response?.message ?? "OTP sent."}${response?.verification?.devOtp ? ` Dev OTP: ${response.verification.devOtp}` : ""}`
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to send email OTP."
      );
    }
  }

  const emailChanged =
    String(form.email ?? "").trim().toLowerCase() !==
    String(profile.email ?? "").trim().toLowerCase();

  return (
    <section className="glass-card dashboard-panel teacher-profile-panel" id="profile">
      <DashboardPanelHeader
        label="Profile"
        title="Edit your student details and profile photo."
      />

      <div className="teacher-profile-layout">
        <div className="teacher-profile-identity">
          <div className="teacher-profile-avatar">
            {form.avatarDataUrl ? (
              <img src={form.avatarDataUrl} alt={`${form.firstName} ${form.lastName}`} />
            ) : (
              <span>{getInitials(form)}</span>
            )}
          </div>

          <div className="teacher-profile-copy">
            <strong>
              {form.firstName} {form.lastName}
            </strong>
            <span>{form.rollNumber || form.userId}</span>
            <label className="secondary-button teacher-profile-upload">
              Upload Photo
              <input type="file" accept="image/*" onChange={handleImageChange} />
            </label>
          </div>
        </div>

        <form className="teacher-profile-form" onSubmit={handleSubmit}>
          <div className="teacher-profile-grid">
            {editableFields.map((field) => (
              <label key={field.name} className="field">
                <span>{field.label}</span>
                <input
                  type="text"
                  value={form[field.name] ?? ""}
                  onChange={(event) => updateField(field.name, event.target.value)}
                />
              </label>
            ))}
          </div>

          {emailChanged ? (
            <div className="profile-email-otp-panel">
              <p>Verify the new email before saving this profile.</p>
              <label className="field">
                <span>Email OTP</span>
                <input
                  value={emailOtp}
                  onChange={(event) => setEmailOtp(event.target.value)}
                  placeholder="6 digit OTP"
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
              <button
                className="secondary-button"
                type="button"
                onClick={handleRequestOtp}
              >
                Send OTP
              </button>
            </div>
          ) : null}

          <div className="teacher-profile-actions">
            <button className="primary-button" type="submit">
              Save Profile
            </button>
            {status ? <span className="panel-meta">{status}</span> : null}
          </div>
        </form>
      </div>
    </section>
  );
}
