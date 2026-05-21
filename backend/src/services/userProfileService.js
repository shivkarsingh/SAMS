import { AttendanceDraft } from "../models/AttendanceDraft.js";
import { AttendanceRecord } from "../models/AttendanceRecord.js";
import { ClassAssignment } from "../models/ClassAssignment.js";
import { ClassAssignmentSubmission } from "../models/ClassAssignmentSubmission.js";
import { ClassDiscussionMessage } from "../models/ClassDiscussionMessage.js";
import { ClassExam } from "../models/ClassExam.js";
import { ClassMembership } from "../models/ClassMembership.js";
import { Classroom } from "../models/Classroom.js";
import { EmailOtp } from "../models/EmailOtp.js";
import { FaceProfile } from "../models/FaceProfile.js";
import { LeaveRequest } from "../models/LeaveRequest.js";
import { QrAttendanceSession } from "../models/QrAttendanceSession.js";
import { User } from "../models/User.js";
import {
  createEmailOtp,
  getOtpResponseDetails,
  verifyEmailOtp
} from "./emailOtpService.js";
import { sendProfileEmailOtp } from "./emailNotificationService.js";
import { findStudentRollConflict } from "../utils/studentRollNumberScope.js";

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

const MAX_AVATAR_DATA_URL_LENGTH = 2_000_000;

export function normalizeAvatarDataUrl(value) {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return "";
  }

  if (!normalizedValue.startsWith("data:image/")) {
    throw new Error("Profile photo must be an image.");
  }

  if (normalizedValue.length > MAX_AVATAR_DATA_URL_LENGTH) {
    throw new Error("Profile photo is too large. Use a smaller image.");
  }

  return normalizedValue;
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
    semesterLabel: user.semesterLabel,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    emailVerifiedAt: user.emailVerifiedAt,
    emailVerificationRequired: Boolean(user.emailVerificationRequired),
    phoneNumber: user.phoneNumber,
    avatarDataUrl: user.avatarDataUrl ?? "",
    designation: user.designation,
    specialization: user.specialization,
    experienceYears: user.experienceYears,
    joiningYear: user.joiningYear
  };
}

async function findExistingStudentRollConflict(candidate, excludeUserId = "") {
  const studentsWithRollNumber = await User.find({
    role: "student",
    rollNumber: candidate.rollNumber
  }).lean();

  return findStudentRollConflict(studentsWithRollNumber, candidate, excludeUserId);
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

async function replaceDiscussionUserId(previousUserId, nextUserId) {
  await Promise.all([
    ClassDiscussionMessage.updateMany(
      { authorUserId: previousUserId },
      { $set: { authorUserId: nextUserId } }
    ),
    ClassDiscussionMessage.updateMany(
      { "replies.authorUserId": previousUserId },
      { $set: { "replies.$[reply].authorUserId": nextUserId } },
      { arrayFilters: [{ "reply.authorUserId": previousUserId }] }
    ),
    ClassDiscussionMessage.updateMany(
      { likes: previousUserId },
      { $set: { "likes.$[likedUserId]": nextUserId } },
      { arrayFilters: [{ likedUserId: previousUserId }] }
    ),
    ClassDiscussionMessage.updateMany(
      { dislikes: previousUserId },
      { $set: { "dislikes.$[dislikedUserId]": nextUserId } },
      { arrayFilters: [{ dislikedUserId: previousUserId }] }
    )
  ]);
}

async function replaceStudentUserId(previousUserId, nextUserId) {
  await Promise.all([
    ClassMembership.updateMany(
      { studentUserId: previousUserId },
      { $set: { studentUserId: nextUserId } }
    ),
    AttendanceRecord.updateMany(
      { studentId: previousUserId },
      { $set: { studentId: nextUserId } }
    ),
    AttendanceDraft.updateMany(
      { "records.studentId": previousUserId },
      { $set: { "records.$[record].studentId": nextUserId } },
      { arrayFilters: [{ "record.studentId": previousUserId }] }
    ),
    LeaveRequest.updateMany(
      { studentUserId: previousUserId },
      { $set: { studentUserId: nextUserId } }
    ),
    FaceProfile.updateMany(
      { studentUserId: previousUserId },
      {
        $set: {
          studentUserId: nextUserId,
          status: "needs-refresh"
        },
        $addToSet: {
          notes:
            "Account ID changed. Re-enroll this face profile before using AI attendance again."
        }
      }
    ),
    ClassAssignmentSubmission.updateMany(
      { studentUserId: previousUserId },
      { $set: { studentUserId: nextUserId } }
    ),
    EmailOtp.updateMany(
      { role: "student", userId: previousUserId },
      { $set: { userId: nextUserId } }
    )
  ]);
}

async function replaceTeacherUserId(previousUserId, nextUserId) {
  await Promise.all([
    Classroom.updateMany(
      { teacherUserId: previousUserId },
      { $set: { teacherUserId: nextUserId } }
    ),
    Classroom.updateMany(
      { endedBy: previousUserId },
      { $set: { endedBy: nextUserId } }
    ),
    AttendanceRecord.updateMany(
      { teacherUserId: previousUserId },
      { $set: { teacherUserId: nextUserId } }
    ),
    AttendanceDraft.updateMany(
      { teacherUserId: previousUserId },
      { $set: { teacherUserId: nextUserId } }
    ),
    LeaveRequest.updateMany(
      { teacherUserId: previousUserId },
      { $set: { teacherUserId: nextUserId } }
    ),
    LeaveRequest.updateMany(
      { reviewedBy: previousUserId },
      { $set: { reviewedBy: nextUserId } }
    ),
    ClassExam.updateMany(
      { teacherUserId: previousUserId },
      { $set: { teacherUserId: nextUserId } }
    ),
    ClassAssignment.updateMany(
      { teacherUserId: previousUserId },
      { $set: { teacherUserId: nextUserId } }
    ),
    QrAttendanceSession.updateMany(
      { teacherUserId: previousUserId },
      { $set: { teacherUserId: nextUserId } }
    ),
    EmailOtp.updateMany(
      { role: "teacher", userId: previousUserId },
      { $set: { userId: nextUserId } }
    )
  ]);
}

async function replaceProfileUserId({ role, previousUserId, nextUserId }) {
  await replaceDiscussionUserId(previousUserId, nextUserId);

  if (role === "student") {
    await replaceStudentUserId(previousUserId, nextUserId);
    return;
  }

  if (role === "teacher") {
    await replaceTeacherUserId(previousUserId, nextUserId);
  }
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

export async function verifyProfileEmailVerification({
  role,
  userId,
  email,
  otp
}) {
  const user = await getUser(role, userId);
  const normalizedEmail = validateEmail(email);
  const verification = await verifyEmailOtp({
    role: user.role,
    userId: user.userId,
    email: normalizedEmail,
    purpose: "profile-email-verification",
    otp,
    consume: false
  });

  return {
    verifiedAt: verification.verifiedAt
  };
}

export async function updateUserProfile({
  role,
  userId,
  updates,
  emailOtp
}) {
  const user = await getUser(role, userId);
  const hasUserIdUpdate = Object.prototype.hasOwnProperty.call(
    updates,
    "userId"
  );
  const nextUserId = hasUserIdUpdate ? normalizeUserId(updates.userId) : "";
  const userIdChanged = Boolean(nextUserId && nextUserId !== user.userId);

  if (hasUserIdUpdate && !nextUserId) {
    throw new Error("ID is required.");
  }

  if (user.role === "student" && userIdChanged) {
    throw new Error("Student ID is linked to roll number and can only be changed by admin.");
  }

  if (userIdChanged) {
    const existingUser = await User.findOne({
      userId: nextUserId,
      _id: { $ne: user._id }
    }).lean();

    if (existingUser) {
      throw new Error("A user with this ID already exists.");
    }
  }

  const nextEmail = updates.email ? validateEmail(updates.email) : "";
  const emailChanged = nextEmail && nextEmail !== user.email;
  const hasAvatarUpdate = Object.prototype.hasOwnProperty.call(
    updates,
    "avatarDataUrl"
  );
  const nextAvatarDataUrl = hasAvatarUpdate
    ? normalizeAvatarDataUrl(updates.avatarDataUrl)
    : undefined;

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
    user.emailVerificationRequired = false;
  }

  if (user.role === "student") {
    if (
      Object.prototype.hasOwnProperty.call(updates, "rollNumber") &&
      normalizeUserId(updates.rollNumber) !== normalizeUserId(user.rollNumber)
    ) {
      throw new Error("Roll number can only be changed by admin.");
    }

    user.batch = optionalString(updates.batch);
    user.yearOfPassing = optionalNumber(updates.yearOfPassing);
    user.age = optionalNumber(updates.age);
    user.gender = optionalString(updates.gender) ?? user.gender;

    const nextDepartment = Object.prototype.hasOwnProperty.call(
      updates,
      "department"
    )
      ? optionalString(updates.department)
      : user.department;
    const nextSemesterLabel = Object.prototype.hasOwnProperty.call(
      updates,
      "semesterLabel"
    )
      ? optionalString(updates.semesterLabel)
      : user.semesterLabel;

    const duplicateRollNumber = await findExistingStudentRollConflict(
      {
        rollNumber: user.rollNumber,
        department: nextDepartment,
        semesterLabel: nextSemesterLabel
      },
      user.userId
    );

    if (duplicateRollNumber) {
      throw new Error(
        "A student with this roll number already exists in the same branch and semester."
      );
    }

    user.semesterLabel = nextSemesterLabel;
  }

  user.firstName = optionalString(updates.firstName) ?? user.firstName;
  user.lastName = optionalString(updates.lastName) ?? user.lastName;
  user.phoneNumber = optionalString(updates.phoneNumber);
  user.department = Object.prototype.hasOwnProperty.call(updates, "department")
    ? optionalString(updates.department)
    : user.department;

  if (hasAvatarUpdate) {
    user.avatarDataUrl = nextAvatarDataUrl;
  }

  if (user.role === "teacher") {
    user.designation = optionalString(updates.designation);
    user.specialization = optionalString(updates.specialization);
    user.experienceYears = optionalNumber(updates.experienceYears);
    user.joiningYear = optionalNumber(updates.joiningYear);
  }

  if (userIdChanged) {
    await replaceProfileUserId({
      role: user.role,
      previousUserId: user.userId,
      nextUserId
    });
    user.userId = nextUserId;
  }

  await user.save();

  return sanitizeUser(user);
}
