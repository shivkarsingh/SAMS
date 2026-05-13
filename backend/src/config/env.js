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

const configuredFrontendOrigins = (process.env.FRONTEND_ORIGIN ??
  "http://localhost:5173,http://0.0.0.0:5173,https://markin-sams-frontend.vercel.app")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  aiServiceUrl: process.env.AI_SERVICE_URL ?? "http://localhost:8000",
  aiServiceApiKey: process.env.AI_SERVICE_API_KEY ?? "",
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
  frontendAppUrl:
    process.env.FRONTEND_APP_URL ??
    configuredFrontendOrigins.find((origin) => !origin.includes("*")) ??
    "http://localhost:5173",
  mongoUri: process.env.MONGO_URI ?? "mongodb://localhost:27017/sams"
};
