import { getDatabaseStatus } from "../config/db.js";
import { fetchAiHealth } from "../services/aiService.js";
import { getEmailServiceStatus } from "../services/emailService.js";

export async function getHealth(_request, response) {
  const aiService = await fetchAiHealth();
  const database = getDatabaseStatus();
  const email = getEmailServiceStatus();
  const isHealthy = database === "connected" && aiService.ready !== false;

  response.json({
    status: isHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    services: {
      backend: "ok",
      aiService,
      database,
      email
    },
    ready: isHealthy
  });
}
