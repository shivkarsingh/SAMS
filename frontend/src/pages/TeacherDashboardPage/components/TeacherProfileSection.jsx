import { useEffect, useState } from "react";
import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";

const editableFields = [
  { name: "firstName", label: "First name" },
  { name: "lastName", label: "Last name" },
  { name: "email", label: "Email" },
  { name: "department", label: "Department" },
  { name: "designation", label: "Designation" },
  { name: "specialization", label: "Specialization" },
  { name: "experienceYears", label: "Experience" },
  { name: "joiningYear", label: "Joining year" }
];

function getInitials(profile) {
  return `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();
}

export function TeacherProfileSection({ profile, onSaveProfile }) {
  const [form, setForm] = useState(profile);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setForm(profile);
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

  function handleSubmit(event) {
    event.preventDefault();
    onSaveProfile(form);
    setStatus("Profile updated.");
  }

  return (
    <section className="glass-card dashboard-panel teacher-profile-panel" id="profile">
      <DashboardPanelHeader
        label="Profile"
        title="Edit your teacher details and profile photo."
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
            <span>{form.designation}</span>
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
