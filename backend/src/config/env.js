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
  "http://localhost:5173,http://0.0.0.0:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  aiServiceUrl: process.env.AI_SERVICE_URL ?? "http://localhost:8000",
  aiRequestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 120000),
  aiHealthTimeoutMs: Number(process.env.AI_HEALTH_TIMEOUT_MS ?? 5000),
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
