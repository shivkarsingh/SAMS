function normalizeTone(tone) {
  if (tone === "danger") {
    return "danger";
  }

  if (tone === "positive") {
    return "positive";
  }

  return "warning";
}

function formatDateLabel(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export function buildStudentNotifications(dashboard) {
  if (!dashboard) {
    return [];
  }

  const notifications = [];

  (dashboard.alerts ?? []).forEach((alert, index) => {
    notifications.push({
      id: `alert-${index}-${alert.title}`,
      category: "Attendance Alert",
      tone: normalizeTone(alert.tone),
      title: alert.title,
      message: alert.message,
      route: "/student-insights"
    });
  });

  if (dashboard.faceProfile?.status !== "enrolled") {
    notifications.push({
      id: "face-profile-pending",
      category: "Profile Setup",
      tone: "warning",
      title: "Face enrollment is pending",
      message:
        "Complete face enrollment so photo attendance can identify you reliably.",
      route: "/student-face-enrollment"
    });
  }

  (dashboard.upcomingExams ?? []).forEach((exam) => {
    notifications.push({
      id: `exam-${exam.id}`,
      category: "Exam Eligibility",
      tone: normalizeTone(exam.eligibility?.tone),
      title: `${exam.subjectCode} - ${exam.eligibility?.statusLabel ?? "Exam scheduled"}`,
      message: exam.eligibility?.action ?? `${exam.title} is scheduled.`,
      route: "/student-exams"
    });
  });

  (dashboard.classPerformance ?? []).forEach((course) => {
    (course.leaveRequests ?? []).slice(0, 3).forEach((request) => {
      const status = String(request.status ?? "pending").toLowerCase();

      notifications.push({
        id: `leave-${course.id}-${request.id}`,
        category: "Leave Request",
        tone:
          status === "approved"
            ? "positive"
            : status === "rejected"
              ? "danger"
              : "warning",
        title: `${course.code} leave ${status}`,
        message: `${formatDateLabel(request.absenceDate)} - ${
          request.teacherNote || request.reason || "Teacher review status updated."
        }`,
        route: `/student-classroom?classId=${encodeURIComponent(course.id)}`
      });
    });
  });

  if (!notifications.length) {
    notifications.push({
      id: "all-clear",
      category: "All Clear",
      tone: "positive",
      title: "No urgent notifications",
      message:
        "Join classes, keep your face profile ready, and attendance alerts will appear here.",
      route: "/student-dashboard"
    });
  }

  return notifications;
}

export function getStudentNotificationCount(dashboard) {
  return buildStudentNotifications(dashboard).filter(
    (notification) => notification.tone !== "positive"
  ).length;
}
