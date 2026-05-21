import { useEffect, useState } from "react";
import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";
import { goToRoute } from "../../../utils/router";
import "./StudentClassroomSection.css";

function JoinedClassroomCard({ joinedClass }) {
  const analytics = joinedClass.analytics ?? {};
  const total = analytics.total ?? 0;
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
          <span>Status</span>
          <strong>{analytics.statusLabel ?? "No records"}</strong>
        </div>
        <div>
          <span>{analytics.classesNeededForSafeRange ? "Recovery" : "Safe Misses"}</span>
          <strong>
            {analytics.classesNeededForSafeRange
              ? `${analytics.classesNeededForSafeRange} unit${analytics.classesNeededForSafeRange === 1 ? "" : "s"}`
              : total
                ? analytics.safeMissesAvailable ?? 0
                : "Pending"}
          </strong>
        </div>
        <div>
          <span>Next Class</span>
          <strong>{joinedClass.nextSlot?.time ?? joinedClass.scheduleSummary ?? "TBD"}</strong>
        </div>
      </div>

      <div className="joined-classroom-quickline">
        <span>{analytics.statusLabel ?? "No records yet"}</span>
        <span>
          {analytics.classesNeededForSafeRange
            ? `${analytics.classesNeededForSafeRange} units to recover`
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
      </div>
    </article>
  );
}

export function StudentClassroomSection({
  joinedClasses = [],
  onJoinClass,
  initialJoinInput = "",
  showJoinForm = true,
  showJoinedClasses = true,
  label = "Classroom Hub",
  title = `${joinedClasses.length} joined class${joinedClasses.length === 1 ? "" : "es"}`,
  description = "Open any class workspace for attendance history, schedule, assignments, notes, and discussion."
}) {
  const [joinInput, setJoinInput] = useState(initialJoinInput);
  const [status, setStatus] = useState({
    pending: false,
    tone: "",
    message: ""
  });

  useEffect(() => {
    setJoinInput(initialJoinInput);
  }, [initialJoinInput]);

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
        label={label}
        title={title}
        description={description}
      />

      {showJoinForm ? (
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
      ) : null}

      {showJoinedClasses ? (
        <div className="joined-classroom-list">
          {joinedClasses.length ? (
            joinedClasses.map((joinedClass) => (
              <JoinedClassroomCard key={joinedClass.id} joinedClass={joinedClass} />
            ))
          ) : (
            <p className="panel-fallback">
              No classrooms joined yet. Join a classroom from the dashboard.
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}
