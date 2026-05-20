import { User } from "../models/User.js";
import {
  createEmailOtp,
  getOtpResponseDetails,
  verifyEmailOtp
} from "./emailOtpService.js";
import { sendProfileEmailOtp } from "./emailNotificationService.js";

function normalizeUserId(userId) {
  return String(userId ?? "").trim().toUpperCase();
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function optionalString(value) {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue || undefined;
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function validateEmail(email, label = "email") {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error(`Enter a valid ${label} address.`);
  }

  return normalizedEmail;
}

function sanitizeUser(user) {
  return {
    id: user._id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    userId: user.userId,
    rollNumber: user.rollNumber,
    age: user.age,
    gender: user.gender,
    batch: user.batch,
    yearOfPassing: user.yearOfPassing,
    department: user.department,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    emailVerifiedAt: user.emailVerifiedAt,
    emailVerificationRequired: Boolean(user.emailVerificationRequired),
    phoneNumber: user.phoneNumber,
    designation: user.designation,
    specialization: user.specialization,
    experienceYears: user.experienceYears,
    joiningYear: user.joiningYear
  };
}

async function getUser(role, userId) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  const normalizedUserId = normalizeUserId(userId);

  if (!["student", "teacher"].includes(normalizedRole)) {
    throw new Error("Choose a valid account role.");
  }

  const user = await User.findOne({
    role: normalizedRole,
    userId: normalizedUserId
  });

  if (!user) {
    throw new Error("Account not found.");
  }

  return user;
}

export async function requestProfileEmailVerification({
  role,
  userId,
  email
}) {
  const user = await getUser(role, userId);
  const normalizedEmail = validateEmail(email);
  const otpDetails = await createEmailOtp({
    role: user.role,
    userId: user.userId,
    email: normalizedEmail,
    purpose: "profile-email-verification"
  });
  const emailStatus = await sendProfileEmailOtp({
    user,
    email: normalizedEmail,
    otp: otpDetails.otp,
    expiresAt: otpDetails.expiresAt
  });

  return {
    user: sanitizeUser(user),
    verification: getOtpResponseDetails({
      otp: otpDetails.otp,
      expiresAt: otpDetails.expiresAt,
      emailStatus
    })
  };
}

export async function updateUserProfile({
  role,
  userId,
  updates,
  emailOtp
}) {
  const user = await getUser(role, userId);
  const nextEmail = updates.email ? validateEmail(updates.email) : "";
  const emailChanged = nextEmail && nextEmail !== user.email;

  if (emailChanged) {
    await verifyEmailOtp({
      role: user.role,
      userId: user.userId,
      email: nextEmail,
      purpose: "profile-email-verification",
      otp: emailOtp
    });

    user.email = nextEmail;
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationRequired = true;
  }

  if (user.role === "student") {
    const nextRollNumber = optionalString(updates.rollNumber)?.toUpperCase();
    if (nextRollNumber && nextRollNumber !== user.rollNumber) {
      const existingRollNumber = await User.findOne({
        role: "student",
        rollNumber: nextRollNumber,
        userId: { $ne: user.userId }
      }).lean();

      if (existingRollNumber) {
        throw new Error("A student with this roll number already exists.");
      }

      user.rollNumber = nextRollNumber;
    }

    user.batch = optionalString(updates.batch);
    user.yearOfPassing = optionalNumber(updates.yearOfPassing);
    user.age = optionalNumber(updates.age);
    user.gender = optionalString(updates.gender) ?? user.gender;
  }

  user.firstName = optionalString(updates.firstName) ?? user.firstName;
  user.lastName = optionalString(updates.lastName) ?? user.lastName;
  user.phoneNumber = optionalString(updates.phoneNumber);
  user.department = optionalString(updates.department);

  if (user.role === "teacher") {
    user.designation = optionalString(updates.designation);
    user.specialization = optionalString(updates.specialization);
    user.experienceYears = optionalNumber(updates.experienceYears);
    user.joiningYear = optionalNumber(updates.joiningYear);
  }

  await user.save();

  return sanitizeUser(user);
}
