import { getDatabaseStatus } from "../config/db.js";
import { fetchAiHealth } from "../services/aiService.js";

export async function getHealth(_request, response) {
  const aiService = await fetchAiHealth();

  response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      backend: "ok",
      aiService,
      database: getDatabaseStatus()
    }
  });
}

