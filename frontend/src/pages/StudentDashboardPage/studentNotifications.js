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

function getStudentClassRoute(classId) {
  return `/student-classroom?classId=${encodeURIComponent(classId)}`;
}

function isAbsentAttendanceRecord(record) {
  return String(record?.status ?? "").trim().toLowerCase() === "absent";
}

function getAlertCategory(alert) {
  const title = String(alert?.title ?? "").toLowerCase();

  if (title.includes("low attendance") || title.includes("below safe range")) {
    return "Low Attendance";
  }

  if (title.includes("cancelled")) {
    return "Class Alert";
  }

  return "Dashboard Alert";
}

function getAlertRoute() {
  return "/student-performance";
}

function isExamEligibilityAlert(alert) {
  return String(alert?.title ?? "").toLowerCase().includes("exam eligibility");
}

function getNotificationStorageKey(dashboard) {
  const userId = String(dashboard?.profile?.userId ?? "student")
    .trim()
    .toUpperCase();

  return `sams.studentNotifications.seen.${userId || "student"}`;
}

function getActionableNotifications(dashboard) {
  return buildStudentNotifications(dashboard).filter(
    (notification) => notification.tone !== "positive"
  );
}

function readSeenNotificationIds(dashboard) {
  if (typeof localStorage === "undefined") {
    return new Set();
  }

  try {
    const parsedValue = JSON.parse(
      localStorage.getItem(getNotificationStorageKey(dashboard)) ?? "[]"
    );

    return new Set(Array.isArray(parsedValue) ? parsedValue : []);
  } catch (_error) {
    return new Set();
  }
}

function writeSeenNotificationIds(dashboard, notificationIds) {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      getNotificationStorageKey(dashboard),
      JSON.stringify(Array.from(notificationIds))
    );
  } catch (_error) {
    // Ignore storage errors so notifications still render.
  }
}

export function buildStudentNotifications(dashboard) {
  if (!dashboard) {
    return [];
  }

  const notifications = [];

  (dashboard.classPerformance ?? []).forEach((course) => {
    (course.recentAttendance ?? [])
      .filter(isAbsentAttendanceRecord)
      .slice(0, 2)
      .forEach((record) => {
        notifications.push({
          id: `absent-${course.id}-${record.sessionId || record.id || record.recordedAt}`,
          category: "Absent Alert",
          tone: "danger",
          title: `${course.code} marked absent`,
          message: `You were marked absent for ${course.title} on ${
            record.recordedLabel ?? formatDateLabel(record.recordedAt)
          }.`,
          route: getStudentClassRoute(course.id)
        });
      });
  });

  (dashboard.upcomingExams ?? []).forEach((exam) => {
    const daysUntilExam = Number(exam.daysUntilExam ?? 999);
    const eligibilityAction = exam.eligibility?.action
      ? ` ${exam.eligibility.action}`
      : "";

    notifications.push({
      id: `exam-date-${exam.id}`,
      category: "Exam Date",
      tone: daysUntilExam <= 1 ? "danger" : "warning",
      title: `${exam.subjectCode} exam on ${exam.examDateLabel}`,
      message: `${exam.title} is scheduled for ${exam.examDateLabel}.${eligibilityAction}`,
      route: "/student-exams"
    });
  });

  (dashboard.assignmentNotifications ?? []).forEach((assignment) => {
    notifications.push({
      id: `assignment-${assignment.id}`,
      category: "Assignment",
      tone: "warning",
      title: `${assignment.subjectCode} assignment given`,
      message: `${assignment.title} is due on ${assignment.deadlineLabel}.`,
      route: getStudentClassRoute(assignment.classId)
    });
  });

  (dashboard.alerts ?? []).filter((alert) => !isExamEligibilityAlert(alert)).forEach((alert, index) => {
    notifications.push({
      id: `alert-${index}-${alert.title}`,
      category: getAlertCategory(alert),
      tone: normalizeTone(alert.tone),
      title: alert.title,
      message: alert.message,
      route: getAlertRoute(alert)
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

export function markStudentNotificationsSeen(dashboard) {
  const seenIds = readSeenNotificationIds(dashboard);

  getActionableNotifications(dashboard).forEach((notification) => {
    seenIds.add(notification.id);
  });
  writeSeenNotificationIds(dashboard, seenIds);
}

export function getStudentNotificationCount(dashboard) {
  const seenIds = readSeenNotificationIds(dashboard);

  return getActionableNotifications(dashboard).filter(
    (notification) => !seenIds.has(notification.id)
  ).length;
}
