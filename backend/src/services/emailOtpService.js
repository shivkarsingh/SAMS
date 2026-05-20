import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../config/env.js";
import { EmailOtp } from "../models/EmailOtp.js";

function normalizeUserId(userId) {
  return String(userId ?? "").trim().toUpperCase();
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export async function createEmailOtp({ role, userId, email, purpose }) {
  const otp = generateOtp();
  const normalizedUserId = normalizeUserId(userId);
  const normalizedEmail = normalizeEmail(email);
  const expiresAt = new Date(
    Date.now() + env.emailOtpExpiresMinutes * 60 * 1000
  );
  const activeOtp = await EmailOtp.findOne({
    role,
    userId: normalizedUserId,
    email: normalizedEmail,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (activeOtp && env.emailOtpResendCooldownSeconds > 0) {
    const ageMs = Date.now() - activeOtp.createdAt.getTime();
    const cooldownMs = env.emailOtpResendCooldownSeconds * 1000;

    if (ageMs < cooldownMs) {
      const retryAfterSeconds = Math.ceil((cooldownMs - ageMs) / 1000);
      const error = new Error(
        `Please wait ${retryAfterSeconds} seconds before requesting a new OTP.`
      );
      error.retryAfterSeconds = retryAfterSeconds;
      throw error;
    }
  }

  await EmailOtp.updateMany(
    {
      role,
      userId: normalizedUserId,
      email: normalizedEmail,
      purpose,
      consumedAt: null
    },
    {
      $set: {
        consumedAt: new Date()
      }
    }
  );

  const otpRecord = await EmailOtp.create({
    role,
    userId: normalizedUserId,
    email: normalizedEmail,
    purpose,
    otpHash: await bcrypt.hash(otp, 10),
    expiresAt
  });

  return {
    otp,
    expiresAt,
    otpId: String(otpRecord._id)
  };
}

export async function verifyEmailOtp({
  role,
  userId,
  email,
  purpose,
  otp,
  consume = true
}) {
  const normalizedOtp = String(otp ?? "").trim();

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new Error("Enter the 6 digit OTP sent to your email.");
  }

  const otpRecord = await EmailOtp.findOne({
    role,
    userId: normalizeUserId(userId),
    email: normalizeEmail(email),
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new Error("OTP is invalid or expired.");
  }

  if (otpRecord.attempts >= 5) {
    otpRecord.consumedAt = new Date();
    await otpRecord.save();
    throw new Error("OTP attempt limit reached. Request a new OTP.");
  }

  const isValid = await bcrypt.compare(normalizedOtp, otpRecord.otpHash);

  if (!isValid) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    throw new Error("OTP is incorrect.");
  }

  const verifiedAt = new Date();

  if (consume) {
    otpRecord.consumedAt = verifiedAt;
    await otpRecord.save();
  }

  return {
    verifiedAt
  };
}

export function getOtpResponseDetails({ otp, expiresAt, emailStatus }) {
  return {
    expiresAt,
    emailStatus,
    ...(env.emailExposeOtpInResponse ? { devOtp: otp } : {})
  };
}
