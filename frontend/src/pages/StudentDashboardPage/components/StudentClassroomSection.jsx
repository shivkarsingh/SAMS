import { useState } from "react";
import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";
import { goToRoute } from "../../../utils/router";
import "./StudentClassroomSection.css";

function JoinedClassroomCard({ joinedClass }) {
  const analytics = joinedClass.analytics ?? {};
  const attended = analytics.attended ?? 0;
  const total = analytics.total ?? 0;
  const absent = analytics.absent ?? Math.max(0, total - attended);
  const percentage = analytics.studentPercentage ?? 0;
  const statusTone = analytics.statusTone ?? "neutral";

  return (
    <article className="joined-classroom-card">
      <div className="joined-classroom-header">
        <div>
          <span className="course-code">{joinedClass.subjectCode}</span>
          <h3>{joinedClass.subjectName}</h3>
        </div>
        <span className={`joined-classroom-pill ${statusTone}`}>
          {total ? `${percentage}%` : "No records"}
        </span>
      </div>

      <p className="course-meta">
        {joinedClass.teacherName} • {joinedClass.section} •{" "}
        {joinedClass.room || "Room update pending"}
      </p>

      <div className="joined-classroom-meta">
        <div>
          <span>Present</span>
          <strong>{attended}</strong>
        </div>
        <div>
          <span>Absent</span>
          <strong>{absent}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>{total}</strong>
        </div>
      </div>

      <div className="joined-classroom-quickline">
        <span>{analytics.statusLabel ?? "No records yet"}</span>
        <span>
          {analytics.classesNeededForSafeRange
            ? `${analytics.classesNeededForSafeRange} to recover`
            : total
              ? `${analytics.safeMissesAvailable ?? 0} safe misses`
              : joinedClass.scheduleSummary || "Schedule pending"}
        </span>
        <span>Last: {analytics.lastMarkedLabel ?? "Not recorded"}</span>
      </div>

      <div className="student-classroom-actions student-joined-class-actions">
        <button
          className="primary-button"
          type="button"
          onClick={() =>
            goToRoute(
              `/student-classroom?classId=${encodeURIComponent(joinedClass.id)}`
            )
          }
        >
          Open Class
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            goToRoute(`/class-notes?classId=${encodeURIComponent(joinedClass.id)}`)
          }
        >
          Open Notes
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            goToRoute(
              `/class-assignments?classId=${encodeURIComponent(joinedClass.id)}`
            )
          }
        >
          Open Assignments
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            goToRoute(
              `/class-discussion?classId=${encodeURIComponent(joinedClass.id)}`
            )
          }
        >
          Open Discussion
        </button>
      </div>
    </article>
  );
}

export function StudentClassroomSection({ joinedClasses, onJoinClass }) {
  const [joinInput, setJoinInput] = useState("");
  const [status, setStatus] = useState({
    pending: false,
    tone: "",
    message: ""
  });

  async function handleSubmit(event) {
    event.preventDefault();

    if (!joinInput.trim()) {
      setStatus({
        pending: false,
        tone: "warning",
        message: "Enter the join code shared by your teacher."
      });
      return;
    }

    setStatus({
      pending: true,
      tone: "",
      message: ""
    });

    try {
      const response = await onJoinClass(joinInput.trim());
      setJoinInput("");
      setStatus({
        pending: false,
        tone: "success",
        message: response.message
      });
    } catch (error) {
      setStatus({
        pending: false,
        tone: "warning",
        message:
          error instanceof Error ? error.message : "Unable to join this class."
      });
    }
  }

  return (
    <article className="glass-card dashboard-panel student-classroom-panel" id="classrooms">
      <DashboardPanelHeader
        label="Classroom Hub"
        title={`${joinedClasses.length} joined class${joinedClasses.length === 1 ? "" : "es"}`}
        description="Open any class for attendance history, schedule, assignments, notes, and discussion."
      />

      <form className="classroom-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Join code</span>
          <input
            type="text"
            value={joinInput}
            onChange={(event) => setJoinInput(event.target.value)}
            placeholder="Enter SAMS-XXXXXX"
          />
        </label>

        <div className="student-classroom-actions">
          <button className="primary-button" type="submit" disabled={status.pending}>
            {status.pending ? "Joining..." : "Join Class"}
          </button>
          <span className="panel-meta">
            Teachers create the class once, then you join and stay mapped to that roster.
          </span>
        </div>

        {status.message ? (
          <p className={`student-status-copy ${status.tone}`}>{status.message}</p>
        ) : null}
      </form>

      <div className="joined-classroom-list">
        {joinedClasses.length ? (
          joinedClasses.map((joinedClass) => (
            <JoinedClassroomCard key={joinedClass.id} joinedClass={joinedClass} />
          ))
        ) : (
          <p className="panel-fallback">
            No classrooms joined yet. Paste the invite link or join code to get started.
          </p>
        )}
      </div>
    </article>
  );
}
