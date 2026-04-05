import { createApp } from "./app.js";
import { connectToDatabase } from "./config/db.js";
import { env } from "./config/env.js";

const app = createApp();

try {
  await connectToDatabase();

  app.listen(env.port, () => {
    console.log(`Backend listening on http://localhost:${env.port}`);
  });
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Unable to start backend server."
  );
  process.exit(1);
}
