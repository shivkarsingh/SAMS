import {
  getEmailServiceStatus,
  sendEmailServiceTest,
  verifyEmailService
} from "../services/emailService.js";
import { env } from "../config/env.js";

export async function getEmailStatus(_request, response) {
  response.json({
    email: getEmailServiceStatus()
  });
}

export async function verifyEmailStatus(_request, response) {
  const email = await verifyEmailService({ force: true });

  response.json({
    message:
      email.status === "online"
        ? "Email SMTP connection verified."
        : "Email SMTP connection is not ready.",
    email
  });
}

export async function sendEmailTest(request, response) {
  const { to, testKey } = request.body ?? {};

  if (!env.emailTestKey || testKey !== env.emailTestKey) {
    response.status(403).json({
      message:
        "Email test is protected. Set EMAIL_TEST_KEY and send it as testKey."
    });
    return;
  }

  try {
    const result = await sendEmailServiceTest({ to });

    response.json({
      message:
        result.status === "sent"
          ? "Test email sent successfully."
          : "Test email was not sent.",
      emailStatus: result
    });
  } catch (error) {
    response.status(400).json({
      message:
        error instanceof Error ? error.message : "Unable to send test email."
    });
  }
}
