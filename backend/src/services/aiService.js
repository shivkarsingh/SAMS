import { env } from "../config/env.js";

async function postAiJson(path, payload, fallbackMessage) {
  let response;

  try {
    response = await fetch(`${env.aiServiceUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw new Error(
      `AI service is unreachable at ${env.aiServiceUrl}. Start the AI service and try again.`
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail ?? data.message ?? fallbackMessage);
  }

  return data;
}

export async function fetchAiHealth() {
  try {
    const response = await fetch(`${env.aiServiceUrl}/health`);

    if (!response.ok) {
      return "unreachable";
    }

    const payload = await response.json();

    return payload.status;
  } catch {
    return "offline";
  }
}

export async function verifyAttendanceWithAi(payload) {
  return postAiJson(
    "/api/v1/inference/face-match",
    payload,
    "AI service verification failed."
  );
}

export async function processClassroomAttendanceWithAi(payload) {
  return postAiJson(
    "/api/v1/attendance/classroom-recognition",
    payload,
    "AI service classroom attendance processing failed."
  );
}

export async function finalizeClassroomAttendanceWithAi(payload) {
  return postAiJson(
    "/api/v1/attendance/finalize",
    payload,
    "AI service attendance finalization failed."
  );
}

export async function enrollFaceProfileWithAi(payload) {
  return postAiJson(
    "/api/v1/faces/enroll",
    payload,
    "AI service face enrollment failed."
  );
}
