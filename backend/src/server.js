import { createApp } from "./app.js";
import { connectToDatabase } from "./config/db.js";
import { env } from "./config/env.js";
import { startAttendanceDraftScheduler } from "./services/attendanceDraftScheduler.js";
import { ensureDefaultAdminUser } from "./services/authService.js";
import { verifyEmailService } from "./services/emailService.js";

const app = createApp();

try {
  await connectToDatabase();
  await ensureDefaultAdminUser();
  void verifyEmailService({ force: true }).then((email) => {
    console.log(`Email service status: ${email.status}.`);
  });
  startAttendanceDraftScheduler();

  app.listen(env.port, () => {
    console.log(`Backend listening on http://localhost:${env.port}`);
  });
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Unable to start backend server."
  );
  process.exit(1);
}
