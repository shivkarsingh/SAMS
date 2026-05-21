import { DashboardPanelHeader } from "../../../components/common/DashboardPanelHeader";

const studentTools = [
  {
    id: "face-enrollment",
    label: "Face Enrollment",
    description: "Capture or refresh your face profile.",
    actionKey: "onOpenFaceEnrollment"
  },
  {
    id: "calculator",
    label: "Attendance Calculator",
    description: "Calculate attendance for a custom exam date.",
    actionKey: "onOpenAttendanceCalculator"
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "View exams and class days in one calendar.",
    actionKey: "onOpenCalendar"
  },
  {
    id: "exam-eligibility",
    label: "Upcoming Exams & Eligibility",
    description: "Check exam dates and required attendance.",
    actionKey: "onOpenExamEligibility"
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Open attendance, exam, and assignment alerts.",
    actionKey: "onOpenNotifications"
  },
  {
    id: "performance",
    label: "Review Class Performance",
    description: "Compare safe range and subject trends.",
    actionKey: "onReviewPerformance"
  },
  {
    id: "classes",
    label: "Classes Joined",
    description: "Open joined class workspaces.",
    actionKey: "onOpenClassrooms"
  },
  {
    id: "todos",
    label: "To Do",
    description: "Keep personal study and attendance tasks.",
    actionKey: "onOpenTodos"
  }
];

export function StudentToolsSection({
  onOpenFaceEnrollment,
  onOpenAttendanceCalculator,
  onOpenCalendar,
  onOpenExamEligibility,
  onOpenNotifications,
  onReviewPerformance,
  onOpenClassrooms,
  onOpenTodos,
  notificationCount = 0
}) {
  const handlers = {
    onOpenFaceEnrollment,
    onOpenAttendanceCalculator,
    onOpenCalendar,
    onOpenExamEligibility,
    onOpenNotifications,
    onReviewPerformance,
    onOpenClassrooms,
    onOpenTodos
  };

  return (
    <section className="glass-card dashboard-panel student-tools-panel" id="tools">
      <DashboardPanelHeader
        label="Tools"
        title="Open focused student tools."
      />

      <div className="student-tools-grid">
        {studentTools.map((tool) => (
          <button
            key={tool.id}
            className="student-tool-card"
            type="button"
            onClick={handlers[tool.actionKey]}
          >
            {tool.id === "notifications" && notificationCount ? (
              <span className="student-tool-badge">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            ) : null}
            <strong>{tool.label}</strong>
            <span>{tool.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
