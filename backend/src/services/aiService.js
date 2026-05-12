import { env } from "../config/env.js";

function normalizeAiFailureMessage(error, fallbackMessage) {
  if (error instanceof Error && error.name === "AbortError") {
    return "AI service request timed out before the models responded.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function formatAiErrorDetail(detail) {
  if (!detail) {
    return "";
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object") {
          const path = Array.isArray(item.loc) ? item.loc.join(".") : "";
          const message = item.msg ?? item.message ?? JSON.stringify(item);

          return path ? `${path}: ${message}` : message;
        }

        return String(item);
      })
      .join("; ");
  }

  if (typeof detail === "object") {
    return detail.message ?? detail.detail ?? JSON.stringify(detail);
  }

  return String(detail);
}

function parseJsonResponse(responseText) {
  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return {};
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = env.aiRequestTimeoutMs) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function postAiJson(path, payload, fallbackMessage) {
  let response;

  try {
    response = await fetchWithTimeout(`${env.aiServiceUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }, env.aiRequestTimeoutMs);
  } catch (error) {
    throw new Error(
      `${normalizeAiFailureMessage(
        error,
        fallbackMessage
      )} AI service endpoint: ${env.aiServiceUrl}${path}`
    );
  }

  const responseText = await response.text();
  const data = parseJsonResponse(responseText);

  if (!response.ok) {
    const aiMessage = formatAiErrorDetail(data.detail ?? data.message);
    const statusText = response.statusText ? ` ${response.statusText}` : "";
    const message = aiMessage || responseText || fallbackMessage;

    throw new Error(
      `${message} AI service responded with ${response.status}${statusText}.`
    );
  }

  return data;
}

export async function fetchAiHealth() {
  try {
    const response = await fetchWithTimeout(
      `${env.aiServiceUrl}/health`,
      {},
      env.aiHealthTimeoutMs
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        status: "offline",
        ready: false,
        message: payload.detail ?? "AI service health probe failed."
      };
    }

    return {
      status: payload.status ?? "unknown",
      ready: Boolean(payload.ready),
      executionMode: payload.executionMode ?? "unknown",
      checks: payload.checks ?? {},
      warnings: payload.warnings ?? []
    };
  } catch (error) {
    return {
      status: "offline",
      ready: false,
      message: normalizeAiFailureMessage(
        error,
        "AI service is unreachable."
      )
    };
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
