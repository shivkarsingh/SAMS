import dotenv from "dotenv";

dotenv.config();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createOriginMatcher(originPattern) {
  if (!originPattern.includes("*")) {
    return null;
  }

  const pattern = `^${originPattern.split("*").map(escapeRegex).join(".*")}$`;
  return new RegExp(pattern);
}

function normalizeUrl(value) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

const configuredFrontendOrigins = (process.env.FRONTEND_ORIGIN ??
  "http://localhost:5173,http://0.0.0.0:5173,https://markin-sams-frontend.vercel.app")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  aiServiceUrl: process.env.AI_SERVICE_URL ?? "http://localhost:8000",
  aiRequestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 120000),
  aiHealthTimeoutMs: Number(process.env.AI_HEALTH_TIMEOUT_MS ?? 5000),
  aiGatewayRetryCount: Number(process.env.AI_GATEWAY_RETRY_COUNT ?? 1),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? "35mb",
  maxClassroomCaptureImages: Number(
    process.env.MAX_CLASSROOM_CAPTURE_IMAGES ?? 4
  ),
  maxClassroomImageBytes: Number(
    process.env.MAX_CLASSROOM_IMAGE_BYTES ?? 8 * 1024 * 1024
  ),
  aiFaceRecognitionModel:
    process.env.AI_FACE_RECOGNITION_MODEL ??
    "ArcFace ResNet100@Glint360K (InsightFace antelopev2)",
  aiExecutionMode: process.env.AI_EXECUTION_MODE ?? "production",
  frontendOrigins: configuredFrontendOrigins,
  frontendOriginMatchers: configuredFrontendOrigins
    .map(createOriginMatcher)
    .filter(Boolean),
  frontendAppUrl: normalizeUrl(
    process.env.FRONTEND_APP_URL ??
      configuredFrontendOrigins.find((origin) => !origin.includes("*")) ??
      "http://localhost:5173"
  ),
  emailEnabled: String(process.env.EMAIL_ENABLED ?? "false").toLowerCase() === "true",
  emailFrom: process.env.EMAIL_FROM ?? "SAMS Notifications <no-reply@sams.local>",
  emailHost: process.env.EMAIL_HOST ?? "",
  emailPort: Number(process.env.EMAIL_PORT ?? 587),
  emailSecure: String(process.env.EMAIL_SECURE ?? "false").toLowerCase() === "true",
  emailUser: process.env.EMAIL_USER ?? "",
  emailPassword: process.env.EMAIL_PASSWORD ?? "",
  emailRetryCount: Number(process.env.EMAIL_RETRY_COUNT ?? 2),
  emailRetryDelayMs: Number(process.env.EMAIL_RETRY_DELAY_MS ?? 1500),
  emailQueueConcurrency: Number(process.env.EMAIL_QUEUE_CONCURRENCY ?? 3),
  emailConnectionTimeoutMs: Number(process.env.EMAIL_CONNECTION_TIMEOUT_MS ?? 10000),
  emailTestRecipient: process.env.EMAIL_TEST_RECIPIENT ?? "",
  emailTestKey: process.env.EMAIL_TEST_KEY ?? "",
  emailExposeOtpInResponse:
    String(process.env.EMAIL_EXPOSE_OTP_IN_RESPONSE ?? "true").toLowerCase() ===
    "true",
  emailOtpExpiresMinutes: Number(process.env.EMAIL_OTP_EXPIRES_MINUTES ?? 10),
  emailOtpResendCooldownSeconds: Number(
    process.env.EMAIL_OTP_RESEND_COOLDOWN_SECONDS ?? 60
  ),
  mongoUri: process.env.MONGO_URI ?? "mongodb://localhost:27017/sams"
};
