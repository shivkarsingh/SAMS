import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../config/env.js";
import { EmailOtp } from "../models/EmailOtp.js";
import { User } from "../models/User.js";
import {
  createEmailOtp,
  getOtpResponseDetails,
  verifyEmailOtp
} from "./emailOtpService.js";
import {
  sendEmailVerificationOtp,
  sendPasswordResetOtp,
  sendWelcomeEmail
} from "./emailNotificationService.js";
import {
  findStudentRollConflict,
  normalizeRollNumber
} from "../utils/studentRollNumberScope.js";

function normalizeUserId(userId) {
  return String(userId ?? "").trim().toUpperCase();
}

function optionalString(value) {
  const normalizedValue = String(value ?? "").trim();
  return normalizedValue || undefined;
}

function buildStudentUserId(firstName, rollNumber) {
  const namePart = String(firstName ?? "").trim().replace(/\s+/g, "");
  const rollPart = normalizeRollNumber(rollNumber);

  return namePart && rollPart ? normalizeUserId(`${namePart}#${rollPart}`) : "";
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

async function findExistingStudentRollConflict(candidate) {
  const studentsWithRollNumber = await User.find({
    role: "student",
    rollNumber: candidate.rollNumber
  }).lean();

  return findStudentRollConflict(studentsWithRollNumber, candidate);
}

function getSignupEmailOtpUserId(email) {
  return `SIGNUP:${normalizeEmail(email)}`;
}

function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function assertValidSignupPayload(payload, normalizedUserId, normalizedRollNumber) {
  const firstName = optionalString(payload.firstName);
  const lastName = optionalString(payload.lastName);

  if (!firstName || firstName.length < 2 || !lastName || lastName.length < 2) {
    throw new Error("First name and last name must be at least 2 characters.");
  }

  if (!normalizedUserId) {
    throw new Error("ID is required.");
  }

  if (!String(payload.password ?? "")) {
    throw new Error("Password is required.");
  }

  if (String(payload.confirmPassword ?? "") !== String(payload.password ?? "")) {
    throw new Error("Password and confirm password must match.");
  }

  if (payload.role === "student" && !normalizedRollNumber) {
    throw new Error("Roll number is required.");
  }

  if (payload.role === "student" && !/^\d+$/.test(normalizedRollNumber)) {
    throw new Error("Roll number must contain numbers only.");
  }

  const email = optionalString(payload.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  if (!String(payload.emailOtp ?? "").trim()) {
    throw new Error("Verify email with OTP before creating the account.");
  }

  const phoneNumber = optionalString(payload.phoneNumber);
  if (phoneNumber && !/^\+?[0-9\s-]{7,15}$/.test(phoneNumber)) {
    throw new Error("Enter a valid phone number.");
  }
}

export async function registerUser(payload) {
  if (!["student", "teacher"].includes(payload.role)) {
    throw new Error("Choose student or teacher for signup.");
  }

  const normalizedRollNumber =
    payload.role === "student" ? normalizeRollNumber(payload.rollNumber) : "";
  const normalizedUserId =
    payload.role === "student"
      ? normalizeUserId(payload.userId) ||
        buildStudentUserId(payload.firstName, normalizedRollNumber)
      : normalizeUserId(payload.userId);
  assertValidSignupPayload(payload, normalizedUserId, normalizedRollNumber);

  const existingUser = await User.findOne({ userId: normalizedUserId });

  if (existingUser) {
    throw new Error("A user with this ID already exists.");
  }

  if (payload.role === "student") {
    const existingRollNumber = await findExistingStudentRollConflict({
      rollNumber: normalizedRollNumber,
      department: payload.department,
      semesterLabel: payload.semesterLabel
    });

    if (existingRollNumber) {
      throw new Error(
        "A student with this roll number already exists in the same branch and semester."
      );
    }
  }

  const verification = await verifyEmailOtp({
    role: payload.role,
    userId: getSignupEmailOtpUserId(payload.email),
    email: payload.email,
    purpose: "email-verification",
    otp: payload.emailOtp
  });
  const emailVerifiedAt = verification.verifiedAt;

  const passwordHash = await bcrypt.hash(payload.password, 10);

  const user = await User.create({
    role: payload.role,
    firstName: payload.firstName,
    lastName: payload.lastName,
    userId: normalizedUserId,
    rollNumber: normalizedRollNumber,
    passwordHash,
    age: optionalNumber(payload.age),
    gender: optionalString(payload.gender),
    batch: optionalString(payload.batch),
    yearOfPassing: optionalNumber(payload.yearOfPassing),
    department: optionalString(payload.department),
    semesterLabel: optionalString(payload.semesterLabel),
    email: normalizeEmail(payload.email),
    emailVerified: true,
    emailVerifiedAt,
    emailVerificationRequired: false,
    phoneNumber: optionalString(payload.phoneNumber),
    designation: optionalString(payload.designation),
    specialization: optionalString(payload.specialization),
    experienceYears: optionalNumber(payload.experienceYears),
    joiningYear: optionalNumber(payload.joiningYear)
  });

  return {
    user: sanitizeUser(user),
    verification: null
  };
}

export async function requestSignupEmailVerification({
  role,
  userId,
  firstName,
  lastName,
  email
}) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  const normalizedEmail = normalizeEmail(email);

  if (!["student", "teacher"].includes(normalizedRole)) {
    throw new Error("Choose student or teacher for signup.");
  }

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid email address.");
  }

  const otpDetails = await createEmailOtp({
    role: normalizedRole,
    userId: getSignupEmailOtpUserId(normalizedEmail),
    email: normalizedEmail,
    purpose: "email-verification"
  });
  const emailStatus = await sendEmailVerificationOtp({
    user: {
      role: normalizedRole,
      userId: optionalString(userId) ?? "Pending signup",
      firstName:
        optionalString(firstName) ??
        (normalizedRole === "teacher" ? "Teacher" : "Student"),
      lastName: optionalString(lastName) ?? "",
      email: normalizedEmail
    },
    otp: otpDetails.otp,
    expiresAt: otpDetails.expiresAt
  });

  return {
    verification: getOtpResponseDetails({
      otp: otpDetails.otp,
      expiresAt: otpDetails.expiresAt,
      emailStatus
    })
  };
}

export async function verifySignupEmailVerification({ role, email, otp }) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  const normalizedEmail = normalizeEmail(email);

  if (!["student", "teacher"].includes(normalizedRole)) {
    throw new Error("Choose student or teacher for signup.");
  }

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid email address.");
  }

  const verification = await verifyEmailOtp({
    role: normalizedRole,
    userId: getSignupEmailOtpUserId(normalizedEmail),
    email: normalizedEmail,
    purpose: "email-verification",
    otp,
    consume: false
  });

  return {
    verifiedAt: verification.verifiedAt
  };
}

export async function loginUser({ role, userId, password }) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  const normalizedUserId = normalizeUserId(userId);
  const user = await User.findOne({ userId: normalizedUserId, role: normalizedRole });

  if (!user) {
    throw new Error("Invalid role, ID, or password.");
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new Error("Invalid role, ID, or password.");
  }

  if (user.email && !user.emailVerified) {
    const error = new Error(
      "Verify your email with OTP before logging in."
    );
    error.code = "EMAIL_VERIFICATION_REQUIRED";
    error.verificationRequired = true;
    throw error;
  }

  return sanitizeUser(user);
}

export async function ensureDefaultAdminUser() {
  const defaultAdminUserId = normalizeUserId(
    process.env.ADMIN_USER_ID ?? "user"
  );
  const defaultAdminPassword = process.env.ADMIN_PASSWORD ?? "user59";

  const existingAnyRole = await User.findOne({ userId: defaultAdminUserId });

  if (existingAnyRole && existingAnyRole.role !== "admin") {
    console.warn(
      `Default admin ${defaultAdminUserId} was not created because this ID belongs to a ${existingAnyRole.role} account.`
    );
    return sanitizeUser(existingAnyRole);
  }

  if (existingAnyRole) {
    const passwordMatches = await bcrypt.compare(
      defaultAdminPassword,
      existingAnyRole.passwordHash
    );

    if (!passwordMatches) {
      existingAnyRole.passwordHash = await bcrypt.hash(defaultAdminPassword, 10);
    }

    existingAnyRole.emailVerified = true;
    existingAnyRole.emailVerifiedAt = existingAnyRole.emailVerifiedAt ?? new Date();
    existingAnyRole.emailVerificationRequired = false;
    await existingAnyRole.save();

    return sanitizeUser(existingAnyRole);
  }

  const admin = await User.create({
    role: "admin",
    firstName: "System",
    lastName: "Admin",
    userId: defaultAdminUserId,
    passwordHash: await bcrypt.hash(defaultAdminPassword, 10),
    email: process.env.ADMIN_EMAIL ?? "admin@sams.local",
    emailVerified: true,
    emailVerifiedAt: new Date(),
    emailVerificationRequired: false,
    designation: "Platform Administrator",
    department: "Administration"
  });

  console.log(`Default admin account ready with ID ${defaultAdminUserId}.`);

  return sanitizeUser(admin);
}

export async function resendUserEmailVerification({ role, userId }) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  const normalizedUserId = normalizeUserId(userId);

  if (!["student", "teacher"].includes(normalizedRole)) {
    throw new Error("Choose a valid account role.");
  }

  if (!normalizedUserId) {
    throw new Error("ID is required.");
  }

  const user = await User.findOne({
    userId: normalizedUserId,
    role: normalizedRole
  });

  if (!user) {
    throw new Error("No account found for this role and ID.");
  }

  if (!user.email) {
    throw new Error("This account does not have an email address.");
  }

  if (user.emailVerified) {
    return {
      user: sanitizeUser(user),
      verification: {
        emailStatus: {
          status: "skipped",
          reason: "already-verified"
        }
      }
    };
  }

  const otpDetails = await createEmailOtp({
    role: user.role,
    userId: user.userId,
    email: user.email,
    purpose: "email-verification"
  });
  const emailStatus = await sendEmailVerificationOtp({
    user,
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

export async function verifyUserEmail({ role, userId, otp }) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  const normalizedUserId = normalizeUserId(userId);
  const user = await User.findOne({
    userId: normalizedUserId,
    role: normalizedRole
  });

  if (!user) {
    throw new Error("No account found for this role and ID.");
  }

  if (!user.email) {
    throw new Error("This account does not have an email address.");
  }

  await verifyEmailOtp({
    role: user.role,
    userId: user.userId,
    email: user.email,
    purpose: "email-verification",
    otp
  });

  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationRequired = false;
  await user.save();

  const welcomeEmailStatus = await sendWelcomeEmail({ user });

  return {
    user: sanitizeUser(user),
    emailStatus: welcomeEmailStatus
  };
}

export async function requestPasswordReset({ role, userId }) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  const normalizedUserId = normalizeUserId(userId);

  if (!["student", "teacher"].includes(normalizedRole)) {
    throw new Error("Choose a valid account role.");
  }

  const user = await User.findOne({
    userId: normalizedUserId,
    role: normalizedRole
  });

  if (!user) {
    throw new Error("No account found for this role and ID.");
  }

  if (!user.email) {
    throw new Error("This account does not have an email address.");
  }

  const otpDetails = await createEmailOtp({
    role: user.role,
    userId: user.userId,
    email: user.email,
    purpose: "password-reset"
  });
  const emailStatus = await sendPasswordResetOtp({
    user,
    otp: otpDetails.otp,
    expiresAt: otpDetails.expiresAt
  });

  return {
    user: sanitizeUser(user),
    reset: getOtpResponseDetails({
      otp: otpDetails.otp,
      expiresAt: otpDetails.expiresAt,
      emailStatus
    })
  };
}

export async function verifyPasswordResetOtp({ role, userId, otp }) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  const normalizedUserId = normalizeUserId(userId);
  const normalizedOtp = String(otp ?? "").trim();

  if (!["student", "teacher"].includes(normalizedRole)) {
    throw new Error("Choose a valid account role.");
  }

  if (!normalizedUserId) {
    throw new Error("ID is required.");
  }

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new Error("Enter the 6 digit OTP sent to your email.");
  }

  const user = await User.findOne({
    userId: normalizedUserId,
    role: normalizedRole
  });

  if (!user) {
    throw new Error("No account found for this role and ID.");
  }

  if (!user.email) {
    throw new Error("This account does not have an email address.");
  }

  const otpRecord = await EmailOtp.findOne({
    role: user.role,
    userId: user.userId,
    email: user.email,
    purpose: "password-reset",
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

  const isValidOtp = await bcrypt.compare(normalizedOtp, otpRecord.otpHash);

  if (!isValidOtp) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    throw new Error("OTP is incorrect.");
  }

  const resetToken = generateResetToken();
  const resetTokenExpiresAt = new Date(
    Date.now() + env.emailOtpExpiresMinutes * 60 * 1000
  );
  const verifiedAt = new Date();

  otpRecord.consumedAt = verifiedAt;
  otpRecord.resetVerifiedAt = verifiedAt;
  otpRecord.resetTokenHash = await bcrypt.hash(resetToken, 10);
  otpRecord.resetTokenExpiresAt = resetTokenExpiresAt;
  otpRecord.expiresAt = resetTokenExpiresAt;
  await otpRecord.save();

  return {
    user: sanitizeUser(user),
    resetSession: {
      resetToken,
      expiresAt: resetTokenExpiresAt,
      verifiedAt
    }
  };
}

async function consumePasswordResetToken({ user, resetToken }) {
  const normalizedToken = String(resetToken ?? "").trim();

  if (normalizedToken.length < 32) {
    throw new Error("Verify OTP before setting a new password.");
  }

  const resetRecords = await EmailOtp.find({
    role: user.role,
    userId: user.userId,
    email: normalizeEmail(user.email),
    purpose: "password-reset",
    resetVerifiedAt: { $ne: null },
    resetTokenHash: { $type: "string" },
    passwordResetAt: null,
    resetTokenExpiresAt: { $gt: new Date() }
  })
    .sort({ resetVerifiedAt: -1 })
    .limit(5);

  for (const resetRecord of resetRecords) {
    const isValidToken = await bcrypt.compare(
      normalizedToken,
      resetRecord.resetTokenHash
    );

    if (isValidToken) {
      resetRecord.passwordResetAt = new Date();
      resetRecord.consumedAt = resetRecord.consumedAt ?? resetRecord.passwordResetAt;
      await resetRecord.save();
      return;
    }
  }

  throw new Error("Password reset session is invalid or expired. Request a new OTP.");
}

export async function resetUserPassword({
  role,
  userId,
  otp,
  resetToken,
  password,
  confirmPassword
}) {
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  const normalizedUserId = normalizeUserId(userId);

  if (!["student", "teacher"].includes(normalizedRole)) {
    throw new Error("Choose a valid account role.");
  }

  if (!normalizedUserId) {
    throw new Error("ID is required.");
  }

  if (!String(password ?? "")) {
    throw new Error("Password is required.");
  }

  if (String(confirmPassword ?? "") !== String(password ?? "")) {
    throw new Error("New password and confirm password must match.");
  }

  const user = await User.findOne({
    userId: normalizedUserId,
    role: normalizedRole
  });

  if (!user) {
    throw new Error("No account found for this role and ID.");
  }

  if (!user.email) {
    throw new Error("This account does not have an email address.");
  }

  if (resetToken) {
    await consumePasswordResetToken({ user, resetToken });
  } else if (otp) {
    await verifyEmailOtp({
      role: user.role,
      userId: user.userId,
      email: user.email,
      purpose: "password-reset",
      otp
    });
  } else {
    throw new Error("Verify OTP before setting a new password.");
  }

  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();

  return sanitizeUser(user);
}

function sanitizeUser(userDocument) {
  return {
    id: userDocument._id,
    role: userDocument.role,
    firstName: userDocument.firstName,
    lastName: userDocument.lastName,
    userId: userDocument.userId,
    rollNumber: userDocument.rollNumber,
    age: userDocument.age,
    gender: userDocument.gender,
    batch: userDocument.batch,
    yearOfPassing: userDocument.yearOfPassing,
    department: userDocument.department,
    semesterLabel: userDocument.semesterLabel,
    email: userDocument.email,
    emailVerified: Boolean(userDocument.emailVerified),
    emailVerifiedAt: userDocument.emailVerifiedAt,
    emailVerificationRequired: Boolean(userDocument.emailVerificationRequired),
    phoneNumber: userDocument.phoneNumber,
    avatarDataUrl: userDocument.avatarDataUrl ?? "",
    designation: userDocument.designation,
    specialization: userDocument.specialization,
    experienceYears: userDocument.experienceYears,
    joiningYear: userDocument.joiningYear
  };
}
