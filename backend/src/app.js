import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        const isAllowedOrigin =
          !origin ||
          env.frontendOrigins.includes(origin) ||
          env.frontendOriginMatchers.some((matcher) => matcher.test(origin));

        if (isAllowedOrigin) {
          callback(null, true);
          return;
        }

        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    })
  );
  app.use(express.json({ limit: "25mb" }));

  app.get("/", (_request, response) => {
    response.json({
      message: "SAMS backend is running."
    });
  });

  app.use("/api/v1", apiRouter);

  app.use((error, _request, response, _next) => {
    const statusCode = error.statusCode ?? error.status ?? 500;

    response.status(statusCode).json({
      message:
        error instanceof Error
          ? error.message
          : "The backend could not complete this request."
    });
  });

  return app;
}
