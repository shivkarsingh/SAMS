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
  scheduleSlots: [],
  description: ""
};

const initialScheduleDraft = {
  days: [],
  startTime: "",
  endTime: ""
};

const scheduleDays = [
  { id: "mon", shortLabel: "M", label: "Monday" },
  { id: "tue", shortLabel: "T", label: "Tuesday" },
  { id: "wed", shortLabel: "W", label: "Wednesday" },
  { id: "thu", shortLabel: "Th", label: "Thursday" },
  { id: "fri", shortLabel: "F", label: "Friday" },
  { id: "sat", shortLabel: "Sat", label: "Saturday" },
  { id: "sun", shortLabel: "Sun", label: "Sunday" }
];

function RequiredMark() {
  return (
    <span className="required-marker" aria-label="required">
      *
    </span>
  );
}

export function TeacherClassCreationSection({
  onCreateClass
}) {
  const [form, setForm] = useState(initialForm);
  const [scheduleDraft, setScheduleDraft] = useState(initialScheduleDraft);
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

  function updateScheduleDraft(field, value) {
    setScheduleDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  function toggleScheduleDay(dayId) {
    setScheduleDraft((currentDraft) => {
      const daySet = new Set(currentDraft.days);

      if (daySet.has(dayId)) {
        daySet.delete(dayId);
      } else {
        daySet.add(dayId);
      }

      return {
        ...currentDraft,
        days: scheduleDays
          .map((day) => day.id)
          .filter((day) => daySet.has(day))
      };
    });
  }

  function addScheduleSlot() {
    if (
      !scheduleDraft.days.length ||
      !scheduleDraft.startTime ||
      !scheduleDraft.endTime
    ) {
      setStatus({
        pending: false,
        tone: "warning",
        message: "Choose at least one day, start time, and end time."
      });
      return;
    }

    if (scheduleDraft.endTime <= scheduleDraft.startTime) {
      setStatus({
        pending: false,
        tone: "warning",
        message: "End time must be after start time."
      });
      return;
    }

    const nextSlots = scheduleDraft.days.map((day) => ({
      day,
      startTime: scheduleDraft.startTime,
      endTime: scheduleDraft.endTime
    }));

    setForm((currentForm) => {
      const slotByKey = new Map(
        [...currentForm.scheduleSlots, ...nextSlots].map((slot) => [
          `${slot.day}-${slot.startTime}-${slot.endTime}`,
          slot
        ])
      );

      return {
        ...currentForm,
        scheduleSlots: Array.from(slotByKey.values())
      };
    });
    setScheduleDraft(initialScheduleDraft);
    setStatus({
      pending: false,
      tone: "",
      message: ""
    });
  }

  function removeScheduleSlot(slotIndex) {
    setForm((currentForm) => ({
      ...currentForm,
      scheduleSlots: currentForm.scheduleSlots.filter(
        (_slot, index) => index !== slotIndex
      )
    }));
  }

  function getDayLabel(dayId) {
    return scheduleDays.find((day) => day.id === dayId)?.label ?? dayId;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.scheduleSlots.length) {
      setStatus({
        pending: false,
        tone: "warning",
        message: "Add at least one weekly schedule slot before creating the class."
      });
      return;
    }

    setStatus({
      pending: true,
      tone: "",
      message: ""
    });

    try {
      const response = await onCreateClass(form);
      setForm(initialForm);
      setScheduleDraft(initialScheduleDraft);
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

  return (
    <section className="teacher-create-class-section" id="class-management">
      <article className="glass-card dashboard-panel">
        <DashboardPanelHeader
          label="Create Class"
          title="Set subject, room, and weekly schedule in one flow."
        />

        <form className="classroom-form" onSubmit={handleSubmit}>
          <div className="teacher-form-grid">
            <label className="field">
              <span>
                Subject name <RequiredMark />
              </span>
              <input
                type="text"
                value={form.subjectName}
                onChange={(event) => updateField("subjectName", event.target.value)}
                placeholder="Machine Learning"
                required
              />
            </label>
            <label className="field">
              <span>
                Subject code <RequiredMark />
              </span>
              <input
                type="text"
                value={form.subjectCode}
                onChange={(event) => updateField("subjectCode", event.target.value)}
                placeholder="CS301"
                required
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
              <span>
                Semester <RequiredMark />
              </span>
              <input
                type="text"
                value={form.semesterLabel}
                onChange={(event) => updateField("semesterLabel", event.target.value)}
                placeholder="Semester 6"
                required
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
          </div>

          <div className="schedule-builder">
            <div className="schedule-builder-header">
              <div>
                <span className="pill">Weekly Schedule</span>
                <h3>Select class days and time</h3>
              </div>
              <span className="panel-meta">
                These slots build teacher and student timetables automatically.
              </span>
            </div>

            <div className="schedule-day-picker" aria-label="Class days">
              {scheduleDays.map((day) => (
                <button
                  key={day.id}
                  className={`schedule-day-toggle ${
                    scheduleDraft.days.includes(day.id) ? "active" : ""
                  }`}
                  type="button"
                  onClick={() => toggleScheduleDay(day.id)}
                  aria-pressed={scheduleDraft.days.includes(day.id)}
                  title={day.label}
                >
                  {day.shortLabel}
                </button>
              ))}
            </div>

            <div className="schedule-time-grid">
              <label className="field">
                <span>Start time</span>
                <input
                  type="time"
                  value={scheduleDraft.startTime}
                  onChange={(event) =>
                    updateScheduleDraft("startTime", event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>End time</span>
                <input
                  type="time"
                  value={scheduleDraft.endTime}
                  onChange={(event) =>
                    updateScheduleDraft("endTime", event.target.value)
                  }
                />
              </label>
              <button className="secondary-button" type="button" onClick={addScheduleSlot}>
                Add Slot
              </button>
            </div>

            <div className="schedule-slot-preview">
              {form.scheduleSlots.length ? (
                form.scheduleSlots.map((slot, index) => (
                  <button
                    key={`${slot.day}-${slot.startTime}-${slot.endTime}`}
                    className="schedule-slot-chip"
                    type="button"
                    onClick={() => removeScheduleSlot(index)}
                    title="Remove this schedule slot"
                  >
                    <strong>{getDayLabel(slot.day)}</strong>
                    <span>{slot.startTime} - {slot.endTime}</span>
                  </button>
                ))
              ) : (
                <span className="panel-meta">
                  No weekly slots added yet.
                </span>
              )}
            </div>
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
  );
}
