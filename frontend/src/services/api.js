function resolveApiBaseUrl() {
  const configuredBaseUrl = String(process.env.API_BASE_URL ?? "").trim();
  const fallbackBaseUrl = "http://localhost:4000/api/v1";

  if (!configuredBaseUrl) {
    return fallbackBaseUrl;
  }

  if (
    configuredBaseUrl.startsWith("/") &&
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    window.location.port &&
    window.location.port !== "4000"
  ) {
    return `http://localhost:4000${configuredBaseUrl}`.replace(/\/$/, "");
  }

  return configuredBaseUrl.replace(/\/$/, "");
}

const API_BASE_URL = resolveApiBaseUrl();

async function readResponseData(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => "");

  return {
    message:
      text.match(/Cannot\s+(GET|POST|PATCH|DELETE)\s+[^\s<]+/)?.[0] ||
      text.trim() ||
      ""
  };
}

function createRequestError(data, fallbackMessage) {
  const error = new Error(data.message ?? fallbackMessage ?? "Request failed.");
  error.details = data;
  error.code = data.code;
  error.verificationRequired = data.verificationRequired;
  error.retryAfterSeconds = data.retryAfterSeconds;
  return error;
}

async function getJson(path, fallbackMessage) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = await readResponseData(response);

  if (!response.ok) {
    throw createRequestError(data, fallbackMessage);
  }

  return data;
}

export async function fetchPlatformHealth() {
  return getJson("/health", "Failed to fetch platform health.");
}

export async function fetchAttendanceSummary() {
  return getJson("/attendance/summary", "Failed to fetch attendance summary.");
}

export async function fetchStudentDashboard(userId) {
  return getJson(
    `/students/${encodeURIComponent(userId)}/dashboard`,
    "Failed to load student dashboard."
  );
}

export async function fetchTeacherDashboard(userId) {
  return getJson(
    `/teachers/${encodeURIComponent(userId)}/dashboard`,
    "Failed to load teacher dashboard."
  );
}

export async function fetchAdminDashboard(userId) {
  return getJson(
    `/admins/${encodeURIComponent(userId)}/dashboard`,
    "Failed to load admin dashboard."
  );
}

export async function fetchTeacherClassroom(userId, classId) {
  return getJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}`,
    "Failed to load teacher classroom."
  );
}

export async function fetchClassDiscussion(userId, role, classId) {
  const query = new URLSearchParams({
    userId,
    role
  });

  return getJson(
    `/classes/${encodeURIComponent(classId)}/discussion?${query.toString()}`,
    "Failed to load class discussion."
  );
}

export async function fetchClassAssignments(userId, role, classId) {
  const query = new URLSearchParams({
    userId,
    role
  });

  return getJson(
    `/classes/${encodeURIComponent(classId)}/assignments?${query.toString()}`,
    "Failed to load class assignments."
  );
}

export async function fetchStudentFaceProfile(userId) {
  return getJson(
    `/students/${encodeURIComponent(userId)}/face-profile`,
    "Failed to load face profile."
  );
}

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await readResponseData(response);

  if (!response.ok) {
    throw createRequestError(data, "Request failed.");
  }

  return data;
}

async function patchJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await readResponseData(response);

  if (!response.ok) {
    throw createRequestError(data, "Request failed.");
  }

  return data;
}

async function deleteJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE"
  });

  const data = await readResponseData(response);

  if (!response.ok) {
    throw createRequestError(data, "Request failed.");
  }

  return data;
}

export function signupUser(payload) {
  return postJson("/auth/signup", payload);
}

export function requestSignupEmailOtp(payload) {
  return postJson("/auth/signup-email/request", payload);
}

export function verifySignupEmailOtp(payload) {
  return postJson("/auth/signup-email/verify", payload);
}

export function loginUser(payload) {
  return postJson("/auth/login", payload);
}

export function verifyEmail(payload) {
  return postJson("/auth/verify-email", payload);
}

export function resendVerificationEmail(payload) {
  return postJson("/auth/resend-verification", payload);
}

export function requestPasswordReset(payload) {
  return postJson("/auth/password-reset/request", payload);
}

export function verifyPasswordResetOtp(payload) {
  return postJson("/auth/password-reset/verify", payload);
}

export function resetPassword(payload) {
  return postJson("/auth/password-reset/confirm", payload);
}

export function requestProfileEmailOtp(role, userId, payload) {
  return postJson(
    `/users/${encodeURIComponent(role)}/${encodeURIComponent(userId)}/email-otp`,
    payload
  );
}

export function verifyProfileEmailOtp(role, userId, payload) {
  return postJson(
    `/users/${encodeURIComponent(role)}/${encodeURIComponent(userId)}/email-otp/verify`,
    payload
  );
}

export function updateUserProfile(role, userId, payload) {
  return patchJson(
    `/users/${encodeURIComponent(role)}/${encodeURIComponent(userId)}/profile`,
    payload
  );
}

export function updateAdminClassroomStatus(adminId, classId, payload) {
  return patchJson(
    `/admins/${encodeURIComponent(adminId)}/classes/${encodeURIComponent(classId)}/status`,
    payload
  );
}

export function deleteAdminClassroom(adminId, classId) {
  return deleteJson(
    `/admins/${encodeURIComponent(adminId)}/classes/${encodeURIComponent(classId)}`
  );
}

export function updateAdminUserEmailVerification(adminId, role, userId, payload) {
  return patchJson(
    `/admins/${encodeURIComponent(adminId)}/users/${encodeURIComponent(role)}/${encodeURIComponent(userId)}/email-verification`,
    payload
  );
}

export function updateAdminStudentRollNumber(adminId, userId, payload) {
  return patchJson(
    `/admins/${encodeURIComponent(adminId)}/students/${encodeURIComponent(userId)}/roll-number`,
    payload
  );
}

export function deleteAdminUser(adminId, role, userId) {
  return deleteJson(
    `/admins/${encodeURIComponent(adminId)}/users/${encodeURIComponent(role)}/${encodeURIComponent(userId)}`
  );
}

export function joinStudentClass(userId, payload) {
  return postJson(`/students/${encodeURIComponent(userId)}/classes/join`, payload);
}

export function enrollStudentFaceProfile(userId, payload) {
  return postJson(
    `/students/${encodeURIComponent(userId)}/face-profile/enroll`,
    payload
  );
}

export function createTeacherClass(userId, payload) {
  return postJson(`/teachers/${encodeURIComponent(userId)}/classes`, payload);
}

export function addTeacherClassroomStudent(userId, classId, payload) {
  return postJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/students`,
    payload
  );
}

export function updateTeacherClassroomStudent(userId, classId, studentId, payload) {
  return patchJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
    payload
  );
}

export function deleteTeacherClassroomStudent(userId, classId, studentId) {
  return deleteJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`
  );
}

export function submitManualAttendance(userId, classId, payload) {
  return postJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/attendance/manual`,
    payload
  );
}

export function cancelTodayClass(userId, classId, payload) {
  return postJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/cancel-today`,
    payload
  );
}

export function createQrAttendanceSession(userId, classId) {
  return postJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/attendance/qr-session`,
    {}
  );
}

export function markQrAttendance(payload) {
  return postJson("/students/attendance/qr-scan", payload);
}

export function postClassDiscussionMessage(classId, payload) {
  return postJson(
    `/classes/${encodeURIComponent(classId)}/discussion`,
    payload
  );
}

export function postClassDiscussionReply(classId, messageId, payload) {
  return postJson(
    `/classes/${encodeURIComponent(classId)}/discussion/${encodeURIComponent(messageId)}/replies`,
    payload
  );
}

export function postClassDiscussionReaction(classId, messageId, payload) {
  return postJson(
    `/classes/${encodeURIComponent(classId)}/discussion/${encodeURIComponent(messageId)}/reactions`,
    payload
  );
}

export function createClassAssignment(userId, classId, payload) {
  return postJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/assignments`,
    payload
  );
}

export function submitClassAssignment(userId, classId, assignmentId, payload) {
  return postJson(
    `/students/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/assignments/${encodeURIComponent(assignmentId)}/submissions`,
    payload
  );
}

export function submitStudentLeaveRequest(userId, classId, payload) {
  return postJson(
    `/students/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/leave-requests`,
    payload
  );
}

export function reviewTeacherLeaveRequest(userId, classId, requestId, payload) {
  return patchJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/leave-requests/${encodeURIComponent(requestId)}`,
    payload
  );
}

export function setTeacherClassExam(userId, classId, payload) {
  return patchJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/exam`,
    payload
  );
}

export function sendExamAttendanceWarningEmails(userId, classId) {
  return postJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/exam/email-warnings`,
    {}
  );
}

export function archiveTeacherClass(userId, classId) {
  return patchJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/archive`,
    {}
  );
}

export function deleteTeacherClass(userId, classId) {
  return deleteJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}`
  );
}

export function processTeacherAttendance(userId, classId, payload) {
  return postJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/attendance/session`,
    payload
  );
}

export function updateTodayAttendanceDraft(userId, classId, draftId, payload) {
  return patchJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/attendance/today-draft/${encodeURIComponent(draftId)}`,
    payload
  );
}

export function finalizeTodayAttendanceDraft(userId, classId, draftId, payload) {
  return postJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/attendance/today-draft/${encodeURIComponent(draftId)}/finalize`,
    payload
  );
}

export function discardTodayAttendanceDraft(userId, classId, draftId) {
  return deleteJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/attendance/today-draft/${encodeURIComponent(draftId)}`
  );
}

export function sendTodayDraftAbsenteeEmails(userId, classId, draftId, payload) {
  return postJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/attendance/today-draft/${encodeURIComponent(draftId)}/absentee-email`,
    payload
  );
}

export function finalizeTeacherAttendance(userId, classId, payload) {
  return postJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/attendance/finalize`,
    payload
  );
}

export function sendAttendanceAbsenteeEmails(userId, classId, payload) {
  return postJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/attendance/absentee-email`,
    payload
  );
}

export function updateSessionAttendanceRecord(
  userId,
  classId,
  sessionId,
  studentId,
  payload
) {
  return patchJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/attendance/sessions/${encodeURIComponent(sessionId)}/students/${encodeURIComponent(studentId)}`,
    payload
  );
}
