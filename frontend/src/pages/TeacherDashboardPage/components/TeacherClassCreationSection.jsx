import { useState } from "react";
import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";
import "./TeacherClassCreationSection.css";

const initialForm = {
  subjectName: "",
  subjectCode: "",
  section: "",
  room: "",
  semesterLabel: "",
  academicYear: "",
  batch: "",
  scheduleSummary: "",
  description: ""
};

export function TeacherClassCreationSection({
  classesManaged,
  onCreateClass,
  onOpenClassroom
}) {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({
    pending: false,
    tone: "",
    message: ""
  });

  function updateField(field, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({
      pending: true,
      tone: "",
      message: ""
    });

    try {
      const response = await onCreateClass(form);
      setForm(initialForm);
      setStatus({
        pending: false,
        tone: "success",
        message: `${response.message} Share join code ${response.classroom.joinCode} with students.`
      });
    } catch (error) {
      setStatus({
        pending: false,
        tone: "warning",
        message:
          error instanceof Error ? error.message : "Unable to create class."
      });
    }
  }

  async function copyInvite(value, successMessage) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus({
        pending: false,
        tone: "success",
        message: successMessage
      });
    } catch {
      setStatus({
        pending: false,
        tone: "warning",
        message: "Unable to copy to clipboard from this browser."
      });
    }
  }

  return (
    <>
      <section className="glass-card dashboard-panel teacher-manage-classes-panel" id="classes">
        <DashboardPanelHeader
          label="Manage Classes"
          title="All your classes, links, and quick access in one place."
        />

        <div className="teacher-manage-class-list">
          {classesManaged.length ? (
            classesManaged.map((classroom) => (
              <article key={classroom.id} className="teacher-manage-class-card">
                <div className="teacher-setup-header">
                  <div>
                    <span className="course-code">{classroom.code}</span>
                    <h3>{classroom.title}</h3>
                  </div>
                  <span className="teacher-setup-pill">{classroom.section}</span>
                </div>

                <p className="course-meta">
                  {classroom.room} • {classroom.nextClass}
                </p>

                <div className="teacher-share-grid">
                  <div>
                    <span>Join Code</span>
                    <strong>{classroom.joinCode}</strong>
                  </div>
                  <div>
                    <span>Students Joined</span>
                    <strong>{classroom.studentsCount}</strong>
                  </div>
                  <div>
                    <span>Semester</span>
                    <strong>{classroom.semesterLabel || "TBD"}</strong>
                  </div>
                </div>

                <div className="teacher-class-actions teacher-manage-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      copyInvite(
                        classroom.joinLink,
                        `Join link for ${classroom.code} copied to clipboard.`
                      )
                    }
                  >
                    Copy Link
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => onOpenClassroom(classroom.id)}
                  >
                    Open Class
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="panel-fallback">
              No classes created yet. Create your first class below and it will appear here.
            </p>
          )}
        </div>
      </section>

      <section className="teacher-create-class-section" id="class-management">
        <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Create Class"
          title="Set subject details once and generate a secure join flow."
        />

        <form className="classroom-form" onSubmit={handleSubmit}>
          <div className="teacher-form-grid">
            <label className="field">
              <span>Subject name</span>
              <input
                type="text"
                value={form.subjectName}
                onChange={(event) => updateField("subjectName", event.target.value)}
                placeholder="Machine Learning"
              />
            </label>
            <label className="field">
              <span>Subject code</span>
              <input
                type="text"
                value={form.subjectCode}
                onChange={(event) => updateField("subjectCode", event.target.value)}
                placeholder="CS301"
              />
            </label>
            <label className="field">
              <span>Section</span>
              <input
                type="text"
                value={form.section}
                onChange={(event) => updateField("section", event.target.value)}
                placeholder="CSE-A"
              />
            </label>
            <label className="field">
              <span>Room</span>
              <input
                type="text"
                value={form.room}
                onChange={(event) => updateField("room", event.target.value)}
                placeholder="Lab 4"
              />
            </label>
            <label className="field">
              <span>Semester</span>
              <input
                type="text"
                value={form.semesterLabel}
                onChange={(event) => updateField("semesterLabel", event.target.value)}
                placeholder="Semester 6"
              />
            </label>
            <label className="field">
              <span>Academic year</span>
              <input
                type="text"
                value={form.academicYear}
                onChange={(event) => updateField("academicYear", event.target.value)}
                placeholder="2026-27"
              />
            </label>
            <label className="field">
              <span>Batch</span>
              <input
                type="text"
                value={form.batch}
                onChange={(event) => updateField("batch", event.target.value)}
                placeholder="2023-2027"
              />
            </label>
            <label className="field">
              <span>Schedule summary</span>
              <input
                type="text"
                value={form.scheduleSummary}
                onChange={(event) => updateField("scheduleSummary", event.target.value)}
                placeholder="Mon/Wed 11:00 AM - 12:00 PM"
              />
            </label>
          </div>

          <label className="field">
            <span>Description</span>
            <input
              type="text"
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Core theory course with weekly attendance capture."
            />
          </label>

          <div className="teacher-class-actions">
            <button className="primary-button" type="submit" disabled={status.pending}>
              {status.pending ? "Creating..." : "Create Class"}
            </button>
            <span className="panel-meta">
              Students will join through the generated link or code, then attendance can be restricted to that roster.
            </span>
          </div>

          {status.message ? (
            <p className={`teacher-status-copy ${status.tone}`}>{status.message}</p>
          ) : null}
        </form>
        </article>
      </section>
    </>
  );
}
