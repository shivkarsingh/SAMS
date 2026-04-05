const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:4000/api/v1";

async function getJson(path, fallbackMessage) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message ?? fallbackMessage);
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

export async function fetchTeacherClassroom(userId, classId) {
  return getJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}`,
    "Failed to load teacher classroom."
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

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message ?? "Request failed.");
  }

  return data;
}

export function signupUser(payload) {
  return postJson("/auth/signup", payload);
}

export function loginUser(payload) {
  return postJson("/auth/login", payload);
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

export function processTeacherAttendance(userId, classId, payload) {
  return postJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/attendance/session`,
    payload
  );
}

export function finalizeTeacherAttendance(userId, classId, payload) {
  return postJson(
    `/teachers/${encodeURIComponent(userId)}/classes/${encodeURIComponent(classId)}/attendance/finalize`,
    payload
  );
}
