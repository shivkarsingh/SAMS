import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { EmailDeliveryLog } from "../models/EmailDeliveryLog.js";

let cachedTransporter = null;
let verificationStatus = {
  status: "unchecked",
  checkedAt: null,
  error: ""
};
let activeDeliveries = 0;
const deliveryQueue = [];

function normalizeRecipients(recipients) {
  return (Array.isArray(recipients) ? recipients : [recipients])
    .map((recipient) => String(recipient ?? "").trim().toLowerCase())
    .filter(Boolean);
}

function hasSmtpConfig() {
  return Boolean(env.emailHost && env.emailUser && env.emailPassword);
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function withTimeout(promise, ms, message) {
  let timeoutId;
  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.emailHost,
    port: env.emailPort,
    secure: env.emailSecure,
    connectionTimeout: env.emailConnectionTimeoutMs,
    greetingTimeout: env.emailConnectionTimeoutMs,
    socketTimeout: env.emailConnectionTimeoutMs,
    auth: {
      user: env.emailUser,
      pass: env.emailPassword
    }
  });

  return cachedTransporter;
}

function getQueueStatus() {
  return {
    queued: deliveryQueue.length,
    active: activeDeliveries,
    concurrency: Math.max(1, env.emailQueueConcurrency)
  };
}

function getConfigurationStatus() {
  if (!env.emailEnabled) {
    return "disabled";
  }

  if (!hasSmtpConfig()) {
    return "not-configured";
  }

  return verificationStatus.status;
}

async function createDeliveryLog(payload) {
  try {
    if (payload.notificationKey) {
      return await EmailDeliveryLog.findOneAndUpdate(
        {
          notificationKey: payload.notificationKey
        },
        {
          $set: payload
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
    }

    return await EmailDeliveryLog.create(payload);
  } catch (error) {
    if (error?.code === 11000) {
      return {
        status: "skipped",
        reason: "duplicate"
      };
    }

    throw error;
  }
}

async function deliverWithRetries(mailOptions) {
  const maxAttempts = Math.max(1, env.emailRetryCount + 1);
  const attempts = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await withTimeout(
        getTransporter().sendMail(mailOptions),
        env.emailConnectionTimeoutMs + env.emailRetryDelayMs,
        "SMTP send timed out."
      );

      return {
        result,
        attempts
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to send email.";

      attempts.push({
        attempt,
        message,
        at: new Date().toISOString()
      });

      if (attempt >= maxAttempts) {
        const finalError = new Error(message);
        finalError.attempts = attempts;
        throw finalError;
      }

      await wait(env.emailRetryDelayMs * attempt);
    }
  }

  throw new Error("Unable to send email.");
}

function processDeliveryQueue() {
  const concurrency = Math.max(1, env.emailQueueConcurrency);

  while (activeDeliveries < concurrency && deliveryQueue.length) {
    const job = deliveryQueue.shift();

    activeDeliveries += 1;
    job
      .run()
      .then(job.resolve)
      .catch(job.reject)
      .finally(() => {
        activeDeliveries -= 1;
        processDeliveryQueue();
      });
  }
}

function enqueueDelivery(run) {
  return new Promise((resolve, reject) => {
    deliveryQueue.push({
      run,
      resolve,
      reject
    });
    processDeliveryQueue();
  });
}

export async function verifyEmailService({ force = false } = {}) {
  if (!env.emailEnabled) {
    verificationStatus = {
      status: "disabled",
      checkedAt: new Date().toISOString(),
      error: ""
    };
    return getEmailServiceStatus();
  }

  if (!hasSmtpConfig()) {
    verificationStatus = {
      status: "not-configured",
      checkedAt: new Date().toISOString(),
      error: "EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD are required."
    };
    return getEmailServiceStatus();
  }

  if (!force && verificationStatus.status === "online") {
    return getEmailServiceStatus();
  }

  try {
    await withTimeout(
      getTransporter().verify(),
      env.emailConnectionTimeoutMs + env.emailRetryDelayMs,
      "SMTP verification timed out."
    );
    verificationStatus = {
      status: "online",
      checkedAt: new Date().toISOString(),
      error: ""
    };
  } catch (error) {
    cachedTransporter = null;
    verificationStatus = {
      status: "error",
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "SMTP verification failed."
    };
  }

  return getEmailServiceStatus();
}

export function getEmailServiceStatus() {
  return {
    enabled: env.emailEnabled,
    configured: hasSmtpConfig(),
    status: getConfigurationStatus(),
    from: env.emailFrom,
    host: env.emailHost || "not-set",
    port: env.emailPort,
    secure: env.emailSecure,
    checkedAt: verificationStatus.checkedAt,
    error: verificationStatus.error,
    queue: getQueueStatus()
  };
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  template,
  notificationKey = "",
  metadata = {}
}) {
  const recipients = normalizeRecipients(to);

  if (!recipients.length) {
    return {
      status: "skipped",
      reason: "missing-recipient"
    };
  }

  if (notificationKey) {
    const existingLog = await EmailDeliveryLog.findOne({
      notificationKey,
      status: "sent"
    }).lean();

    if (existingLog) {
      return {
        status: "skipped",
        reason: "duplicate",
        logId: String(existingLog._id)
      };
    }
  }

  if (!env.emailEnabled || !hasSmtpConfig()) {
    const reason = env.emailEnabled ? "smtp-not-configured" : "email-disabled";
    console.info("[email:skipped]", {
      to: recipients,
      subject,
      template,
      notificationKey,
      reason
    });

    const log = await createDeliveryLog({
      to: recipients,
      subject,
      template,
      status: "skipped",
      notificationKey: notificationKey || undefined,
      metadata: {
        ...metadata,
        reason
      }
    });

    return {
      status: "skipped",
      reason,
      logId: log?._id ? String(log._id) : undefined
    };
  }

  return enqueueDelivery(async () => {
    try {
      const { result, attempts } = await deliverWithRetries({
        from: env.emailFrom,
        to: recipients,
        subject,
        html,
        text
      });
      verificationStatus = {
        status: "online",
        checkedAt: new Date().toISOString(),
        error: ""
      };

      const log = await createDeliveryLog({
        to: recipients,
        subject,
        template,
        status: "sent",
        providerMessageId: result.messageId ?? "",
        notificationKey: notificationKey || undefined,
        metadata: {
          ...metadata,
          attempts
        }
      });

      return {
        status: "sent",
        providerMessageId: result.messageId,
        attempts: attempts.length + 1,
        logId: log?._id ? String(log._id) : undefined
      };
    } catch (error) {
      const attempts = error?.attempts ?? [];
      const log = await createDeliveryLog({
        to: recipients,
        subject,
        template,
        status: "failed",
        notificationKey: notificationKey || undefined,
        errorMessage:
          error instanceof Error ? error.message : "Unable to send email.",
        metadata: {
          ...metadata,
          attempts
        }
      });

      verificationStatus = {
        status: "error",
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unable to send email."
      };

      return {
        status: "failed",
        reason: error instanceof Error ? error.message : "Unable to send email.",
        attempts: attempts.length,
        logId: log?._id ? String(log._id) : undefined
      };
    }
  });
}

export async function sendEmailServiceTest({ to }) {
  const recipient = String(to || env.emailTestRecipient || "").trim();

  if (!recipient) {
    throw new Error("Set EMAIL_TEST_RECIPIENT or provide a test recipient.");
  }

  return sendEmail({
    to: recipient,
    subject: "SAMS email service test",
    text: "SAMS email delivery is active and working.",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;">
        <h2 style="margin:0 0 12px;">SAMS email service is active</h2>
        <p style="margin:0;">This test confirms SMTP delivery, queue handling, logging, and retry configuration are working.</p>
      </div>
    `,
    template: "email-service-test",
    notificationKey: `email-test:${recipient}:${Date.now()}`,
    metadata: {
      source: "email-test-endpoint"
    }
  });
}
