import { useState } from "react";
import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";
import { goToRoute } from "../../../utils/router";
import "./StudentClassroomSection.css";

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
        message: "Paste a join link or enter the join code shared by your teacher."
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
        title="Join classes with a secure link or class code."
      />

      <form className="classroom-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Join link or join code</span>
          <input
            type="text"
            value={joinInput}
            onChange={(event) => setJoinInput(event.target.value)}
            placeholder="Paste the invite link or enter SAMS-XXXXXX"
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
            <article
              key={joinedClass.id}
              className="joined-classroom-card"
            >
              <div className="joined-classroom-header">
                <div>
                  <span className="course-code">{joinedClass.subjectCode}</span>
                  <h3>{joinedClass.subjectName}</h3>
                </div>
                <span className="joined-classroom-pill">{joinedClass.section}</span>
              </div>

              <p className="course-meta">
                {joinedClass.teacherName} • {joinedClass.room || "Room update pending"}
              </p>

              <div className="joined-classroom-meta">
                <div>
                  <span>Join Code</span>
                  <strong>{joinedClass.joinCode}</strong>
                </div>
                <div>
                  <span>Students Joined</span>
                  <strong>{joinedClass.studentsCount}</strong>
                </div>
                <div>
                  <span>Schedule</span>
                  <strong>{joinedClass.scheduleSummary || "TBD"}</strong>
                </div>
              </div>

              <div className="student-classroom-actions student-joined-class-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    goToRoute(`/class-notes?classId=${encodeURIComponent(joinedClass.id)}`)
                  }
                >
                  Open Notes
                </button>
              </div>
            </article>
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
