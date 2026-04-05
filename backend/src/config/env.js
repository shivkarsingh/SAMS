import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  aiServiceUrl: process.env.AI_SERVICE_URL ?? "http://localhost:8000",
  frontendOrigins: (process.env.FRONTEND_ORIGIN ??
    "http://localhost:5173,http://0.0.0.0:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  frontendAppUrl:
    process.env.FRONTEND_APP_URL ??
    (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)[0] ??
    "http://localhost:5173",
  mongoUri: process.env.MONGO_URI ?? "mongodb://localhost:27017/sams"
};
